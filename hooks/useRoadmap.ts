"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Course, Week, RoadmapTopic } from "@/types/course";
import { roadmapBatchSize, roadmapRefetchThreshold } from "@/lib/config";
import { logger } from "@/lib/logger";
import type { WeekStatusType } from "@/hooks/useProgressiveCourse";

const STORAGE_KEY = "infinite-tutor:roadmap";

interface UseRoadmapOptions {
  enabled: boolean;
  course: Course | null;
  appendWeek: (week: Week, status: WeekStatusType) => void;
}

export function useRoadmap({ enabled, course, appendWeek }: UseRoadmapOptions) {
  const [topics, setTopics] = useState<RoadmapTopic[]>([]);
  const isFetchingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const hasInitialFetchRef = useRef(false);

  // Refs for stable callback access
  const courseRef = useRef(course);
  courseRef.current = course;
  const appendWeekRef = useRef(appendWeek);
  appendWeekRef.current = appendWeek;

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RoadmapTopic[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTopics(parsed);
          logger.info("roadmap", `Restored ${parsed.length} topics from localStorage`);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist to localStorage when topics change
  useEffect(() => {
    if (topics.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
    }
  }, [topics]);

  const fetchRoadmap = useCallback(async () => {
    const currentCourse = courseRef.current;
    if (!currentCourse || isFetchingRef.current) return;

    isFetchingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const weeksCovered = currentCourse.weeks
        .filter(w => w.lectureNotes)
        .map(w => ({
          weekNumber: w.weekNumber,
          title: w.title,
          overview: w.overview,
        }));

      logger.info("roadmap", `Fetching ${roadmapBatchSize} roadmap topics after week ${weeksCovered.length}`);

      const res = await fetch("/api/generate-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: currentCourse.topic,
          level: currentCourse.level,
          weeksCovered,
          count: roadmapBatchSize,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Roadmap API returned ${res.status}`);
      }

      const data = await res.json();
      const newTopics: RoadmapTopic[] = data.topics ?? [];

      logger.info("roadmap", `Received ${newTopics.length} roadmap topics`);

      setTopics(prev => {
        // Merge: keep existing topics, add new ones that don't overlap
        const existingWeeks = new Set(prev.map(t => t.weekNumber));
        const unique = newTopics.filter(t => !existingWeeks.has(t.weekNumber));
        return [...prev, ...unique];
      });

      // Append skeleton weeks for each topic
      for (const topic of newTopics) {
        const skeletonWeek: Week = {
          weekNumber: topic.weekNumber,
          title: topic.title,
          overview: topic.overview,
          prerequisites: [],
          learningObjectives: [],
          lectureNotes: "",
          requiredReading: [],
        };
        appendWeekRef.current(skeletonWeek, "skeleton");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      logger.error("roadmap", `Error fetching roadmap: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Initial fetch when enabled
  useEffect(() => {
    if (enabled && !hasInitialFetchRef.current) {
      hasInitialFetchRef.current = true;
      fetchRoadmap();
    }
    if (!enabled) {
      hasInitialFetchRef.current = false;
    }
  }, [enabled, fetchRoadmap]);

  // Called by prefetch pipeline when topics are running low
  const fetchMore = useCallback(() => {
    fetchRoadmap();
  }, [fetchRoadmap]);

  // Consume a topic (remove it from the list as it's been used)
  const consumeTopic = useCallback((weekNumber: number) => {
    setTopics(prev => prev.filter(t => t.weekNumber !== weekNumber));
  }, []);

  const remainingCount = topics.length;
  const isRunningLow = remainingCount < roadmapRefetchThreshold;

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    isFetchingRef.current = false;
    hasInitialFetchRef.current = false;
    setTopics([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { topics, remainingCount, isRunningLow, fetchMore, consumeTopic, cancel };
}
