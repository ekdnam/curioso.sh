"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Course, Level, Week } from "@/types/course";
import { logger } from "@/lib/logger";
import { fetchGlossaryForWeek } from "@/lib/fetchGlossary";
import type { WeekStatusType } from "@/hooks/useProgressiveCourse";

interface UseInfiniteScrollOptions {
  enabled: boolean;
  course: Course | null;
  appendWeek: (week: Week, status: WeekStatusType) => void;
  updateWeek: (weekNumber: number, updates: Partial<Week>) => void;
  setWeekStatus: (weekNumber: number, status: WeekStatusType) => void;
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
}: UseInfiniteScrollOptions) {
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [nextTopicPreview, setNextTopicPreview] = useState<NextTopicPreview | null>(null);
  const isGeneratingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const triggerNext = useCallback(async () => {
    if (!enabled || !course || isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setIsGeneratingNext(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const weeks = course.weeks;
      const nextWeekNumber = weeks.length + 1;

      // Build weeksCovered summary — only include fully loaded weeks
      const weeksCovered = weeks
        .filter(w => w.lectureNotes)
        .map(w => ({
          weekNumber: w.weekNumber,
          title: w.title,
          overview: w.overview,
        }));

      // Step 1: Recommend next topic
      logger.info("infiniteScroll", `Recommending topic for week ${nextWeekNumber}`);
      const recRes = await fetch("/api/recommend-next-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: course.topic,
          level: course.level,
          weeksCovered,
        }),
        signal: controller.signal,
      });

      if (!recRes.ok) {
        const errData = await recRes.json().catch(() => ({}));
        throw new Error(errData.error || `Recommend API returned ${recRes.status}`);
      }

      const recommendation = (await recRes.json()) as {
        nextTopicTitle: string;
        nextTopicOverview: string;
        rationale: string;
      };

      logger.info("infiniteScroll", `Recommended: "${recommendation.nextTopicTitle}" — ${recommendation.rationale}`);
      setNextTopicPreview({
        title: recommendation.nextTopicTitle,
        overview: recommendation.nextTopicOverview,
      });

      // Step 2: Append skeleton week
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

      // Step 3: Generate full content
      const courseOutline = weeks
        .map(w => `Week ${w.weekNumber}: ${w.title} — ${w.overview}`)
        .join("\n");

      const nextTopicContext = `Title: ${recommendation.nextTopicTitle}\nOverview: ${recommendation.nextTopicOverview}`;

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

      if (!weekData) {
        throw new Error("Week generation returned no data");
      }

      // Force correct weekNumber
      weekData.weekNumber = nextWeekNumber;

      // Step 4: Update week with full content
      updateWeek(nextWeekNumber, weekData);
      setWeekStatus(nextWeekNumber, "loaded");

      logger.info("infiniteScroll", `Week ${nextWeekNumber} loaded`);

      // Step 5: Fire-and-forget glossary
      fetchGlossaryForWeek(weekData, course.topic, controller.signal)
        .then(glossary => {
          if (glossary.length > 0) {
            updateWeek(nextWeekNumber, { glossary });
          }
        })
        .catch(() => {
          // glossary failure is non-fatal
        });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      logger.error("infiniteScroll", `Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      isGeneratingRef.current = false;
      setIsGeneratingNext(false);
      setNextTopicPreview(null);
    }
  }, [enabled, course, appendWeek, updateWeek, setWeekStatus]);

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
