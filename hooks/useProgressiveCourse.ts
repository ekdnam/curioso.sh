"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Course, CourseSkeleton, Level, Week } from "@/types/course";
import { logger } from "@/lib/logger";
import { prefetchAhead } from "@/lib/config";
import { fetchGlossaryForWeek, collectKnownTerms } from "@/lib/fetchGlossary";

const STORAGE_KEY = "curioso:course";
const WEEK_STATUS_KEY = "curioso:week-status";

type WeekStatus = WeekStatusType;

export type WeekStatusType = "skeleton" | "loading" | "loaded";

export type ProgressiveLoadingStage =
  | "refining"
  | "generating-skeleton"
  | "generating-week-1"
  | "generating-course"
  | "generating-glossary"
  | "generating-weeks-1-2"
  | "generating-remaining";

type ProgressiveState =
  | { status: "idle" }
  | { status: "loading"; stage: ProgressiveLoadingStage; topic: string; skeleton?: CourseSkeleton }
  | { status: "success"; course: Course; weekStatus: Record<number, WeekStatus> }
  | { status: "error"; message: string };

function saveCourse(course: Course, weekStatus: Record<number, WeekStatus>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(course));
    localStorage.setItem(WEEK_STATUS_KEY, JSON.stringify(weekStatus));
  } catch {
    // localStorage full or unavailable
  }
}

function loadCourse(): { course: Course; weekStatus: Record<number, WeekStatus> } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const course = JSON.parse(raw) as Course;
    const wsRaw = localStorage.getItem(WEEK_STATUS_KEY);
    const weekStatus = wsRaw ? (JSON.parse(wsRaw) as Record<number, WeekStatus>) : {};
    return { course, weekStatus };
  } catch {
    return null;
  }
}

function clearCourse() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WEEK_STATUS_KEY);
  } catch {
    // ignore
  }
}

/** Build a placeholder Week from skeleton data */
function skeletonToWeek(skel: { weekNumber: number; title: string; description: string }): Week {
  return {
    weekNumber: skel.weekNumber,
    title: skel.title,
    overview: skel.description,
    lectureNotes: "",
    requiredReading: [],
  };
}

export function useProgressiveCourse() {
  const [state, setState] = useState<ProgressiveState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  // Restore from localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    const saved = loadCourse();
    if (saved) {
      logger.info("useProgressiveCourse", "Restored course from localStorage");
      setState({ status: "success", course: saved.course, weekStatus: saved.weekStatus });
    }
  }, []);
  const generationIdRef = useRef(0);
  // Ref for cascade queue so requestWeek can mutate it synchronously
  const cascadeRef = useRef<{
    queue: number[];
    inFlight: Set<number>;
    completed: Set<number>;
    dequeue: () => void;
  } | null>(null);

  // Persist when course/weekStatus changes
  useEffect(() => {
    if (state.status === "success") {
      saveCourse(state.course, state.weekStatus);
    }
  }, [state]);

  const requestWeek = useCallback((weekNum: number) => {
    const cascade = cascadeRef.current;
    if (!cascade) return;
    if (cascade.inFlight.has(weekNum) || cascade.completed.has(weekNum)) return;
    const idx = cascade.queue.indexOf(weekNum);
    if (idx === -1) return;
    // Move to front of queue
    cascade.queue.splice(idx, 1);
    cascade.queue.unshift(weekNum);
    logger.info("progressive", `Prioritized week ${weekNum}`);
    cascade.dequeue();
  }, []);

  async function generate(topic: string, level: Level) {
    logger.info("useProgressiveCourse", `Starting progressive generation — topic="${topic}", level="${level}"`);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const genId = ++generationIdRef.current;

    setState({ status: "loading", stage: "refining", topic });

    try {
      // Step 1: prefilter
      let t0 = performance.now();
      const pfRes = await fetch("/api/prefilter-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
        signal: controller.signal,
      });
      logger.perf("progressive", "prefilter-topic", Math.round(performance.now() - t0));

      let resolvedTopic = topic;
      if (pfRes.ok) {
        const pf = (await pfRes.json()) as {
          sensible: boolean;
          refinedTopic: string;
          wasRefined: boolean;
        };
        resolvedTopic = pf.refinedTopic || topic;
        if (pf.wasRefined) {
          logger.info("progressive", `Topic refined: "${topic}" → "${resolvedTopic}"`);
        }
      }

      if (genId !== generationIdRef.current) return;

      // Step 2: generate skeleton
      setState({ status: "loading", stage: "generating-skeleton", topic: resolvedTopic });
      t0 = performance.now();
      const skelRes = await fetch("/api/generate-skeleton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: resolvedTopic, level }),
        signal: controller.signal,
      });

      if (!skelRes.ok) {
        const data = await skelRes.json();
        throw new Error(data.error || "Skeleton generation failed");
      }

      const skeleton: CourseSkeleton = await skelRes.json();
      logger.perf("progressive", "generate-skeleton", Math.round(performance.now() - t0));
      logger.info("progressive", `Skeleton received — ${skeleton.weeks.length} weeks`);

      if (genId !== generationIdRef.current) return;

      // Build the course outline string for context in week generation
      const courseOutline = skeleton.weeks
        .map(w => `Week ${w.weekNumber}: ${w.title} — ${w.description}`)
        .join("\n");

      // Initialize course with skeleton placeholder weeks
      const initialWeeks = skeleton.weeks.map(skeletonToWeek);
      const initialWeekStatus: Record<number, WeekStatus> = {};
      for (const w of skeleton.weeks) {
        initialWeekStatus[w.weekNumber] = "skeleton";
      }

      const course: Course = {
        courseName: skeleton.courseName,
        description: skeleton.description,
        topic,
        level,
        weeks: initialWeeks,
      };

      // Step 3: generate week 1
      setState({ status: "loading", stage: "generating-week-1", topic: resolvedTopic, skeleton });
      initialWeekStatus[1] = "loading";

      t0 = performance.now();
      const w1Res = await fetch("/api/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: resolvedTopic,
          level,
          weekStart: 1,
          weekEnd: 1,
          courseOutline,
        }),
        signal: controller.signal,
      });

      if (!w1Res.ok) {
        const data = await w1Res.json();
        throw new Error(data.error || "Week 1 generation failed");
      }

      const { raw: w1Raw } = await w1Res.json();
      logger.perf("progressive", "generate-course week 1", Math.round(performance.now() - t0));
      const w1Parsed = JSON.parse(w1Raw);
      const week1: Week = (w1Parsed.weeks ?? [])[0];

      if (!week1) throw new Error("Week 1 generation returned no data");

      if (genId !== generationIdRef.current) return;

      // Fetch glossary for week 1
      const w1Glossary = await fetchGlossaryForWeek(week1, resolvedTopic, controller.signal);
      week1.glossary = w1Glossary;

      // Merge week 1 into course
      course.weeks[0] = week1;
      initialWeekStatus[1] = "loaded";

      // Show the course — user can start reading week 1
      setState({
        status: "success",
        course: { ...course },
        weekStatus: { ...initialWeekStatus },
      });

      if (genId !== generationIdRef.current) return;

      // Accumulate glossary terms across weeks to avoid duplicates
      const glossaryTermAccumulator: string[] = w1Glossary.map(g => g.term);

      // Step 4: cascade remaining weeks
      const queue = Array.from({ length: 9 }, (_, i) => i + 2); // [2, 3, ..., 10]
      const inFlight = new Set<number>();
      const completed = new Set<number>([1]);

      const dequeue = () => {
        while (inFlight.size < prefetchAhead && queue.length > 0) {
          const weekNum = queue.shift()!;
          inFlight.add(weekNum);
          fetchWeek(weekNum);
        }
      };

      const fetchWeek = async (weekNum: number) => {
        // Mark as loading
        setState(prev => {
          if (prev.status !== "success" || genId !== generationIdRef.current) return prev;
          return {
            ...prev,
            weekStatus: { ...prev.weekStatus, [weekNum]: "loading" as const },
          };
        });

        try {
          const wt0 = performance.now();
          const res = await fetch("/api/generate-course", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: resolvedTopic,
              level,
              weekStart: weekNum,
              weekEnd: weekNum,
              courseOutline,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            logger.error("progressive", `Week ${weekNum} fetch failed`);
            inFlight.delete(weekNum);
            dequeue();
            return;
          }

          const { raw } = await res.json();
          logger.perf("progressive", `generate-course week ${weekNum}`, Math.round(performance.now() - wt0));
          const parsed = JSON.parse(raw);
          const weekData: Week = (parsed.weeks ?? [])[0];

          if (!weekData || genId !== generationIdRef.current) {
            inFlight.delete(weekNum);
            dequeue();
            return;
          }

          inFlight.delete(weekNum);
          completed.add(weekNum);

          // Merge into state
          setState(prev => {
            if (prev.status !== "success" || genId !== generationIdRef.current) return prev;
            const newWeeks = [...prev.course.weeks];
            newWeeks[weekNum - 1] = weekData;
            return {
              ...prev,
              course: { ...prev.course, weeks: newWeeks },
              weekStatus: { ...prev.weekStatus, [weekNum]: "loaded" as const },
            };
          });

          // Fire-and-forget glossary fetch for this week, passing known terms
          const knownTerms = [...glossaryTermAccumulator];
          fetchGlossaryForWeek(weekData, resolvedTopic, controller.signal, knownTerms)
            .then(glossary => {
              if (genId !== generationIdRef.current) return;
              // Accumulate newly fetched terms for future weeks
              for (const g of glossary) glossaryTermAccumulator.push(g.term);
              if (glossary.length === 0) return;
              setState(prev => {
                if (prev.status !== "success") return prev;
                const newWeeks = [...prev.course.weeks];
                const idx = weekNum - 1;
                newWeeks[idx] = { ...newWeeks[idx], glossary };
                return { ...prev, course: { ...prev.course, weeks: newWeeks } };
              });
            })
            .catch(() => {
              // glossary failure is non-fatal
            });

          dequeue();
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          logger.error("progressive", `Error fetching week ${weekNum}`);
          inFlight.delete(weekNum);
          dequeue();
        }
      };

      // Store cascade ref for requestWeek
      cascadeRef.current = { queue, inFlight, completed, dequeue };

      // Start the cascade
      dequeue();

    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Something went wrong";
      logger.error("useProgressiveCourse", `Error during generation: ${message}`);
      setState({ status: "error", message });
    }
  }

  // Track whether the initial 10-week cascade is complete
  const initialLoadCompleteRef = useRef(false);

  // Derive initialLoadComplete from state
  const initialLoadComplete = (() => {
    if (initialLoadCompleteRef.current) return true;
    if (state.status !== "success") return false;
    const cascade = cascadeRef.current;
    if (cascade && cascade.completed.size >= 10) {
      initialLoadCompleteRef.current = true;
      return true;
    }
    // Also check if at least 10 weeks are loaded (e.g. restored from localStorage)
    // Note: can't use every() because roadmap may have appended skeleton entries
    const loadedCount = Object.values(state.weekStatus).filter(s => s === "loaded").length;
    if (loadedCount >= 10) {
      initialLoadCompleteRef.current = true;
      return true;
    }
    return false;
  })();

  const appendWeek = useCallback((week: Week, status: WeekStatus) => {
    setState(prev => {
      if (prev.status !== "success") return prev;
      if (prev.course.weeks.some(w => w.weekNumber === week.weekNumber)) return prev;
      return {
        ...prev,
        course: { ...prev.course, weeks: [...prev.course.weeks, week] },
        weekStatus: { ...prev.weekStatus, [week.weekNumber]: status },
      };
    });
  }, []);

  const updateWeek = useCallback((weekNumber: number, updates: Partial<Week>) => {
    setState(prev => {
      if (prev.status !== "success") return prev;
      const newWeeks = prev.course.weeks.map(w =>
        w.weekNumber === weekNumber ? { ...w, ...updates } : w
      );
      return { ...prev, course: { ...prev.course, weeks: newWeeks } };
    });
  }, []);

  const setWeekStatus = useCallback((weekNumber: number, status: WeekStatus) => {
    setState(prev => {
      if (prev.status !== "success") return prev;
      return {
        ...prev,
        weekStatus: { ...prev.weekStatus, [weekNumber]: status },
      };
    });
  }, []);

  function reset() {
    abortRef.current?.abort();
    cascadeRef.current = null;
    initialLoadCompleteRef.current = false;
    clearCourse();
    setState({ status: "idle" });
  }

  return { state, generate, reset, requestWeek, appendWeek, updateWeek, setWeekStatus, initialLoadComplete };
}
