"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Course, Week } from "@/types/course";
import { logger } from "@/lib/logger";
import { generateNextWeek } from "@/lib/generateNextWeek";
import { fetchGlossaryForWeek } from "@/lib/fetchGlossary";
import type { WeekStatusType } from "@/hooks/useProgressiveCourse";

interface UsePrefetchPipelineOptions {
  enabled: boolean;
  course: Course | null;
  appendWeek: (week: Week, status: WeekStatusType) => void;
  updateWeek: (weekNumber: number, updates: Partial<Week>) => void;
  setWeekStatus: (weekNumber: number, status: WeekStatusType) => void;
  prefetchCount: number;
}

export function usePrefetchPipeline({
  enabled,
  course,
  appendWeek,
  updateWeek,
  setWeekStatus,
  prefetchCount,
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

  // Abort controller for cleanup
  const abortRef = useRef<AbortController | null>(null);

  // Initialize consumption frontier when pipeline first enables
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (enabled && course && !hasInitializedRef.current) {
      lastConsumedWeekRef.current = course.weeks.length;
      hasInitializedRef.current = true;
      logger.info("prefetch", `Pipeline activated — consumption frontier at week ${course.weeks.length}`);
    }
    if (!enabled) {
      hasInitializedRef.current = false;
    }
  }, [enabled, course]);

  // Effect-driven pipeline: fires on course changes and tick changes
  useEffect(() => {
    if (!enabled || !courseRef.current) return;

    const currentCourse = courseRef.current;
    const highestLoadedWeek = currentCourse.weeks.length;
    const lastConsumed = lastConsumedWeekRef.current;
    const buffered = highestLoadedWeek - lastConsumed;

    // Don't generate if buffer is full
    if (buffered >= prefetchCount) return;

    // Don't run if already running
    if (isRunningRef.current) return;

    const nextWeekNumber = highestLoadedWeek + 1;

    // Check if week already exists (dedup with sentinel)
    const exists = currentCourse.weeks.some(w => w.weekNumber === nextWeekNumber);
    if (exists) return;

    isRunningRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    const runPipeline = async () => {
      try {
        logger.info("prefetch", `Prefetching week ${nextWeekNumber} (buffer: ${buffered}/${prefetchCount})`);

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
          prerequisites: [],
          learningObjectives: [],
          lectureNotes: "",
          requiredReading: [],
        };
        appendWeekRef.current(skeletonWeek, "loading");

        // Update with full content
        updateWeekRef.current(nextWeekNumber, weekData);
        setWeekStatusRef.current(nextWeekNumber, "loaded");

        logger.info("prefetch", `Week ${nextWeekNumber} prefetched`);

        // Fire-and-forget glossary
        fetchGlossaryForWeek(weekData, currentCourse.topic, controller.signal)
          .then(glossary => {
            if (glossary.length > 0) {
              updateWeekRef.current(nextWeekNumber, { glossary });
            }
          })
          .catch(() => {
            // glossary failure is non-fatal
          });
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
    lastConsumedWeekRef.current = courseRef.current.weeks.length;
    logger.info("prefetch", `Consumption frontier advanced to week ${lastConsumedWeekRef.current}`);
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
