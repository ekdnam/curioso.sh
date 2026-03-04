"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Course, Week, RoadmapTopic } from "@/types/course";
import { logger } from "@/lib/logger";
import { generateNextWeek } from "@/lib/generateNextWeek";
import type { WeekStatusType } from "@/hooks/useProgressiveCourse";

interface UseInfiniteScrollOptions {
  enabled: boolean;
  course: Course | null;
  appendWeek: (week: Week, status: WeekStatusType) => void;
  updateWeek: (weekNumber: number, updates: Partial<Week>) => void;
  setWeekStatus: (weekNumber: number, status: WeekStatusType) => void;
  onWeekConsumed?: () => void;
  roadmap?: RoadmapTopic[];
}

interface NextTopicPreview {
  title: string;
  overview: string;
}

export function useInfiniteScroll({
  enabled,
  course,
  appendWeek,
  updateWeek,
  setWeekStatus,
  onWeekConsumed,
  roadmap,
}: UseInfiniteScrollOptions) {
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [nextTopicPreview, setNextTopicPreview] = useState<NextTopicPreview | null>(null);
  const isGeneratingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Refs for stable access
  const roadmapRef = useRef(roadmap);
  roadmapRef.current = roadmap;

  const triggerNext = useCallback(async () => {
    if (!enabled || !course || isGeneratingRef.current) return;

    // Advance consumption frontier so prefetch pipeline refills buffer
    onWeekConsumed?.();

    const nextWeekNumber = course.weeks.length + 1;

    // Check if the next week was already prefetched
    const existingWeek = course.weeks.find(w => w.weekNumber === nextWeekNumber);
    if (existingWeek && existingWeek.lectureNotes) {
      // Already prefetched with full content — skip generation
      logger.info("infiniteScroll", `Week ${nextWeekNumber} already prefetched — skipping`);
      return;
    }
    if (existingWeek) {
      // Exists but still loading (prefetch in-progress) — skip, let prefetch finish
      logger.info("infiniteScroll", `Week ${nextWeekNumber} prefetch in-progress — skipping`);
      return;
    }

    // Fallback: generate on-demand
    isGeneratingRef.current = true;
    setIsGeneratingNext(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Check if we have a roadmap entry for this week
      const roadmapEntry = roadmapRef.current?.find(t => t.weekNumber === nextWeekNumber);

      if (roadmapEntry) {
        // Fast path: skip recommend, use roadmap topic directly
        setNextTopicPreview({
          title: roadmapEntry.title,
          overview: roadmapEntry.overview,
        });

        const skeletonWeek: Week = {
          weekNumber: nextWeekNumber,
          title: roadmapEntry.title,
          overview: roadmapEntry.overview,
          prerequisites: [],
          learningObjectives: [],
          lectureNotes: "",
          requiredReading: [],
        };
        appendWeek(skeletonWeek, "loading");

        const courseOutline = course.weeks
          .map(w => `Week ${w.weekNumber}: ${w.title} — ${w.overview}`)
          .join("\n");

        const nextTopicContext = `Title: ${roadmapEntry.title}\nOverview: ${roadmapEntry.overview}`;

        const genRes = await fetch("/api/generate-course", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: course.topic,
            level: course.level,
            weekStart: nextWeekNumber,
            weekEnd: nextWeekNumber,
            courseOutline,
            nextTopicContext,
          }),
          signal: controller.signal,
        });

        if (!genRes.ok) {
          const errData = await genRes.json().catch(() => ({}));
          throw new Error(errData.error || `Generate API returned ${genRes.status}`);
        }

        const { raw } = await genRes.json();
        const parsed = JSON.parse(raw);
        const weekData: Week = (parsed.weeks ?? [])[0];

        if (!weekData) throw new Error("Week generation returned no data");
        weekData.weekNumber = nextWeekNumber;

        updateWeek(nextWeekNumber, weekData);
        setWeekStatus(nextWeekNumber, "loaded");

        logger.info("infiniteScroll", `Week ${nextWeekNumber} loaded via roadmap`);
      } else {
        // Full fallback: recommend → generate
        const { recommendation, weekData } = await generateNextWeek({
          course,
          nextWeekNumber,
          signal: controller.signal,
        });

        setNextTopicPreview({
          title: recommendation.nextTopicTitle,
          overview: recommendation.nextTopicOverview,
        });

        const skeletonWeek: Week = {
          weekNumber: nextWeekNumber,
          title: recommendation.nextTopicTitle,
          overview: recommendation.nextTopicOverview,
          prerequisites: [],
          learningObjectives: [],
          lectureNotes: "",
          requiredReading: [],
        };
        appendWeek(skeletonWeek, "loading");

        updateWeek(nextWeekNumber, weekData);
        setWeekStatus(nextWeekNumber, "loaded");

        logger.info("infiniteScroll", `Week ${nextWeekNumber} loaded`);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      logger.error("infiniteScroll", `Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      isGeneratingRef.current = false;
      setIsGeneratingNext(false);
      setNextTopicPreview(null);
    }
  }, [enabled, course, appendWeek, updateWeek, setWeekStatus, onWeekConsumed]);

  // IntersectionObserver on sentinel
  useEffect(() => {
    if (!enabled) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isGeneratingRef.current) {
          triggerNext();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, triggerNext]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    setIsGeneratingNext(false);
    setNextTopicPreview(null);
  }, []);

  return { isGeneratingNext, nextTopicPreview, triggerNext, sentinelRef, cancel };
}
