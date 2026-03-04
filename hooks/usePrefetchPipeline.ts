"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Course, Week, RoadmapTopic } from "@/types/course";
import { logger } from "@/lib/logger";
import { generateNextWeek } from "@/lib/generateNextWeek";
import type { WeekStatusType } from "@/hooks/useProgressiveCourse";

interface UsePrefetchPipelineOptions {
  enabled: boolean;
  course: Course | null;
  appendWeek: (week: Week, status: WeekStatusType) => void;
  updateWeek: (weekNumber: number, updates: Partial<Week>) => void;
  setWeekStatus: (weekNumber: number, status: WeekStatusType) => void;
  prefetchCount: number;
  roadmap?: RoadmapTopic[];
  onRoadmapExhausted?: () => void;
}

export function usePrefetchPipeline({
  enabled,
  course,
  appendWeek,
  updateWeek,
  setWeekStatus,
  prefetchCount,
  roadmap,
  onRoadmapExhausted,
}: UsePrefetchPipelineOptions) {
  // Tick counter — forces re-evaluation when consumeWeek() is called
  const [tick, setTick] = useState(0);

  // Consumption frontier: the highest week index the user has "seen"
  // Starts at course.weeks.length when pipeline activates (i.e. 10)
  const lastConsumedWeekRef = useRef(0);

  // Prevent double execution (React strict mode / concurrent renders)
  const isRunningRef = useRef(false);

  // Ref to always read latest course (stale closure fix)
  const courseRef = useRef(course);
  courseRef.current = course;

  // Refs for stable callback access
  const appendWeekRef = useRef(appendWeek);
  appendWeekRef.current = appendWeek;
  const updateWeekRef = useRef(updateWeek);
  updateWeekRef.current = updateWeek;
  const setWeekStatusRef = useRef(setWeekStatus);
  setWeekStatusRef.current = setWeekStatus;
  const roadmapRef = useRef(roadmap);
  roadmapRef.current = roadmap;
  const onRoadmapExhaustedRef = useRef(onRoadmapExhausted);
  onRoadmapExhaustedRef.current = onRoadmapExhausted;

  // Abort controller for cleanup
  const abortRef = useRef<AbortController | null>(null);

  // Initialize consumption frontier when pipeline first enables
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (enabled && course && !hasInitializedRef.current) {
      // Set frontier to the highest loaded (content-filled) week, not weeks.length
      // which may include skeletons from roadmap
      const loadedWeeks = course.weeks.filter(w => !!w.lectureNotes);
      const highestLoaded = loadedWeeks.length > 0
        ? Math.max(...loadedWeeks.map(w => w.weekNumber))
        : course.weeks.length;
      lastConsumedWeekRef.current = highestLoaded;
      hasInitializedRef.current = true;
      logger.info("prefetch", `Pipeline activated — consumption frontier at week ${highestLoaded}`);
    }
    if (!enabled) {
      hasInitializedRef.current = false;
    }
  }, [enabled, course]);

  // Effect-driven pipeline: fires on course changes and tick changes
  useEffect(() => {
    if (!enabled || !courseRef.current) return;

    const currentCourse = courseRef.current;
    const lastConsumed = lastConsumedWeekRef.current;

    // Count only content-filled weeks beyond frontier as buffered (skeletons don't count)
    const buffered = currentCourse.weeks.filter(
      w => w.weekNumber > lastConsumed && !!w.lectureNotes
    ).length;

    // Don't generate if buffer is full
    if (buffered >= prefetchCount) return;

    // Don't run if already running
    if (isRunningRef.current) return;

    // Target the first week without content (skeleton to fill), or append a new one
    const firstSkeleton = currentCourse.weeks
      .filter(w => !w.lectureNotes)
      .sort((a, b) => a.weekNumber - b.weekNumber)[0];
    const nextWeekNumber = firstSkeleton
      ? firstSkeleton.weekNumber
      : currentCourse.weeks.length + 1;

    const existingWeek = currentCourse.weeks.find(w => w.weekNumber === nextWeekNumber);
    if (existingWeek && existingWeek.lectureNotes) return;

    isRunningRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    const runPipeline = async () => {
      try {
        // Check if we have a roadmap entry for this week
        const roadmapEntry = roadmapRef.current?.find(t => t.weekNumber === nextWeekNumber);

        // Signal if roadmap is running low
        const remaining = roadmapRef.current?.filter(t => t.weekNumber >= nextWeekNumber).length ?? 0;
        if (remaining > 0 && remaining < 5) {
          onRoadmapExhaustedRef.current?.();
        }

        if (roadmapEntry) {
          // Fast path: use roadmap topic, skip recommend-next-topic call
          logger.info("prefetch", `Prefetching week ${nextWeekNumber} via roadmap (buffer: ${buffered}/${prefetchCount})`);

          // Append skeleton if not already present
          if (!existingWeek) {
            const skeletonWeek: Week = {
              weekNumber: nextWeekNumber,
              title: roadmapEntry.title,
              overview: roadmapEntry.overview,
              lectureNotes: "",
              requiredReading: [],
            };
            appendWeekRef.current(skeletonWeek, "loading");
          } else {
            setWeekStatusRef.current(nextWeekNumber, "loading");
          }

          // Generate content directly with topic context from roadmap
          const courseOutline = currentCourse.weeks
            .map(w => `Week ${w.weekNumber}: ${w.title} — ${w.overview}`)
            .join("\n");

          const nextTopicContext = `Title: ${roadmapEntry.title}\nOverview: ${roadmapEntry.overview}`;

          const genRes = await fetch("/api/generate-course", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: currentCourse.topic,
              level: currentCourse.level,
              weekStart: nextWeekNumber,
              weekEnd: nextWeekNumber,
              courseOutline,
              nextTopicContext,
            }),
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          if (!genRes.ok) {
            const errData = await genRes.json().catch(() => ({}));
            throw new Error(errData.error || `Generate API returned ${genRes.status}`);
          }

          const { raw } = await genRes.json();
          const parsed = JSON.parse(raw);
          const weekData: Week = (parsed.weeks ?? [])[0];

          if (!weekData) throw new Error("Week generation returned no data");
          weekData.weekNumber = nextWeekNumber;

          updateWeekRef.current(nextWeekNumber, weekData);
          setWeekStatusRef.current(nextWeekNumber, "loaded");

          logger.info("prefetch", `Week ${nextWeekNumber} prefetched via roadmap`);
        } else {
          // Fallback: full recommend → generate pipeline
          logger.info("prefetch", `Prefetching week ${nextWeekNumber} via recommend (buffer: ${buffered}/${prefetchCount})`);

          const { recommendation, weekData } = await generateNextWeek({
            course: currentCourse,
            nextWeekNumber,
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          // Append skeleton
          const skeletonWeek: Week = {
            weekNumber: nextWeekNumber,
            title: recommendation.nextTopicTitle,
            overview: recommendation.nextTopicOverview,
            lectureNotes: "",
            requiredReading: [],
          };
          appendWeekRef.current(skeletonWeek, "loading");

          // Update with full content
          updateWeekRef.current(nextWeekNumber, weekData);
          setWeekStatusRef.current(nextWeekNumber, "loaded");

          logger.info("prefetch", `Week ${nextWeekNumber} prefetched`);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        logger.error("prefetch", `Error prefetching week ${nextWeekNumber}: ${e instanceof Error ? e.message : "Unknown"}`);
      } finally {
        isRunningRef.current = false;
        // The state updates from appendWeek/updateWeek will cause a re-render,
        // which will re-fire this effect → next iteration
      }
    };

    runPipeline();

    return () => {
      controller.abort();
      isRunningRef.current = false;
    };
  }, [enabled, course, tick, prefetchCount]);

  // Called by the sentinel when the user scrolls past rendered weeks
  const consumeWeek = useCallback(() => {
    if (!courseRef.current) return;
    // Advance frontier to the highest content-filled week (not weeks.length, which includes skeletons)
    const loadedWeeks = courseRef.current.weeks.filter(w => !!w.lectureNotes);
    const highestLoaded = loadedWeeks.length > 0
      ? Math.max(...loadedWeeks.map(w => w.weekNumber))
      : lastConsumedWeekRef.current;
    lastConsumedWeekRef.current = highestLoaded;
    logger.info("prefetch", `Consumption frontier advanced to week ${highestLoaded}`);
    // Bump tick to force effect re-evaluation (ref change alone doesn't trigger re-render)
    setTick(t => t + 1);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    isRunningRef.current = false;
    hasInitializedRef.current = false;
    lastConsumedWeekRef.current = 0;
    setTick(0);
  }, []);

  return { consumeWeek, cancel };
}
