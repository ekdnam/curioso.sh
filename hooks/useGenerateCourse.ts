"use client";

import { useState, useRef, useEffect } from "react";
import { Course, Level, Week } from "@/types/course";
import { logger } from "@/lib/logger";
import { parseCourse } from "@/lib/parseCourse";

const STORAGE_KEY = "infinite-tutor:course";

function saveCourse(course: Course) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(course));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function loadCourse(): Course | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Course;
  } catch {
    return null;
  }
}

function clearCourse() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type LoadingStage =
  | "refining"
  | "generating-weeks-1-2"
  | "generating-remaining";

type State =
  | { status: "idle" }
  | { status: "loading"; stage: LoadingStage; topic: string }
  | { status: "success"; course: Course; loading?: boolean }
  | { status: "error"; message: string };

function getInitialState(): State {
  if (typeof window === "undefined") return { status: "idle" };
  const saved = loadCourse();
  if (saved) {
    logger.info("useGenerateCourse", "Restored course from localStorage");
    return { status: "success", course: saved };
  }
  return { status: "idle" };
}

export function useGenerateCourse() {
  const [state, setState] = useState<State>(getInitialState);
  const abortRef = useRef<AbortController | null>(null);

  // Persist when the course object changes (not on every state update)
  const course = state.status === "success" ? state.course : null;
  useEffect(() => {
    if (course) saveCourse(course);
  }, [course]);

  async function generate(topic: string, level: Level) {
    logger.info("useGenerateCourse", `Starting course generation — topic="${topic}", level="${level}"`);

    // Abort any previous generation
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "loading", stage: "refining", topic });

    try {
      // Step 1: prefilter
      const pfRes = await fetch("/api/prefilter-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
        signal: controller.signal,
      });

      let resolvedTopic = topic;
      if (pfRes.ok) {
        const pf = (await pfRes.json()) as {
          sensible: boolean;
          refinedTopic: string;
          wasRefined: boolean;
        };
        resolvedTopic = pf.refinedTopic || topic;
        if (pf.wasRefined) {
          logger.info("useGenerateCourse", `Topic refined: "${topic}" → "${resolvedTopic}"`);
        }
      }

      // Step 2: generate initial chunk (metadata + weeks 1-2)
      setState({ status: "loading", stage: "generating-weeks-1-2", topic: resolvedTopic });
      const res = await fetch("/api/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: resolvedTopic, level }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Request failed");
      }

      const { raw } = await res.json();
      const course = parseCourse(raw);
      course.topic = topic;
      course.level = level;
      logger.info("useGenerateCourse", `Initial chunk received — ${course.weeks.length} weeks`);

      // Show the course immediately with what we have
      setState({ status: "success", course, loading: true });

      // Build a brief outline from the first 2 weeks for context
      const outline = course.weeks
        .map((w) => `Week ${w.weekNumber}: ${w.title}`)
        .join("\n");

      // Step 3: fire remaining week chunks in parallel
      const chunks: { weekStart: number; weekEnd: number }[] = [
        { weekStart: 3, weekEnd: 6 },
        { weekStart: 7, weekEnd: 10 },
      ];

      const chunkPromises = chunks.map(async ({ weekStart, weekEnd }) => {
        try {
          const chunkRes = await fetch("/api/generate-course", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: resolvedTopic,
              level,
              weekStart,
              weekEnd,
              courseOutline: outline,
            }),
            signal: controller.signal,
          });

          if (!chunkRes.ok) return [];

          const { raw: chunkRaw } = await chunkRes.json();
          const parsed = JSON.parse(chunkRaw);
          const weeks: Week[] = parsed.weeks ?? [];
          logger.info("useGenerateCourse", `Chunk received — weeks ${weekStart}-${weekEnd} (${weeks.length} weeks)`);
          return weeks;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") throw e;
          logger.error("useGenerateCourse", `Error loading weeks ${weekStart}-${weekEnd}`);
          return [];
        }
      });

      // Wait for all chunks concurrently, then merge in one update
      const results = await Promise.allSettled(chunkPromises);
      const allNewWeeks = results.flatMap((r) =>
        r.status === "fulfilled" ? r.value : []
      );

      setState((prev) => {
        if (prev.status !== "success") return prev;
        const merged = [...prev.course.weeks, ...allNewWeeks].sort(
          (a, b) => a.weekNumber - b.weekNumber
        );
        return {
          ...prev,
          course: { ...prev.course, weeks: merged },
          loading: false,
        };
      });

      logger.info("useGenerateCourse", "All chunks loaded");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Something went wrong";
      logger.error("useGenerateCourse", `Error during generation: ${message}`);
      setState({ status: "error", message });
    }
  }

  function reset() {
    abortRef.current?.abort();
    clearCourse();
    setState({ status: "idle" });
  }

  return { state, generate, reset };
}
