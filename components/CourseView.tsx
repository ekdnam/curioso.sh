"use client";

import { useMemo, useState, useEffect, useRef, useCallback, RefObject } from "react";
import { Course, DeepDiveSummary, GlossaryEntry } from "@/types/course";
import { CourseHeader } from "./CourseHeader";
import { WeekDeck } from "./WeekDeck";
import { useDeepDives } from "@/hooks/useDeepDives";
import { useActiveWeek } from "@/hooks/useActiveWeek";
import { ExportPDFButton } from "./ExportPDFButton";
import { deepDiveMode } from "@/lib/config";
import { logger } from "@/lib/logger";

interface Props {
  course: Course;
  onReset: () => void;
  weekStatus?: Record<number, "skeleton" | "loading" | "loaded">;
  onRequestWeek?: (weekNum: number) => void;
  sentinelRef?: RefObject<HTMLDivElement | null>;
  isGeneratingNext?: boolean;
  nextTopicPreview?: { title: string; overview: string } | null;
  onTriggerNext?: () => void;
}

export function CourseView({
  course, onReset, weekStatus, onRequestWeek,
  sentinelRef, isGeneratingNext, nextTopicPreview, onTriggerNext,
}: Props) {
  // Count loaded weeks so the IntersectionObserver re-attaches when skeleton→loaded swaps DOM elements
  const loadedCount = weekStatus
    ? Object.values(weekStatus).filter(s => s === "loaded").length
    : course.weeks.length;
  const { activeIndex, setRef } = useActiveWeek(course.weeks.length, loadedCount);

  // Seed glossary from course.weeks (updated when weeks change)
  const baseGlossary = useMemo(() => {
    const record: Record<number, GlossaryEntry[]> = {};
    for (const week of course.weeks) {
      if (week.glossary) {
        record[week.weekNumber] = week.glossary;
      }
    }
    return record;
  }, [course.weeks]);

  const [glossary, setGlossary] = useState<Record<number, GlossaryEntry[]>>(baseGlossary);

  // Re-sync when base glossary changes (e.g. remaining weeks arrive)
  useEffect(() => {
    setGlossary(prev => ({ ...prev, ...baseGlossary }));
  }, [baseGlossary]);

  const fetchedDeepDives = useDeepDives(
    deepDiveMode === "separate" ? course.weeks : [],
    course.topic
  );
  const deepDives = deepDiveMode === "separate" ? fetchedDeepDives : {};

  // Second-pass glossary: when deep dives arrive in "separate" mode,
  // fetch glossary for the deep dive text and merge into existing glossary.
  const ddGlossaryFetched = useRef<Set<number>>(new Set());

  const mergeDeepDiveGlossary = useCallback(
    async (weekNumber: number, items: DeepDiveSummary[]) => {
      const text = items
        .map(dd => `${dd.title}\n${dd.summary}`)
        .join("\n\n");
      try {
        logger.info("CourseView", `Fetching deep-dive glossary for week ${weekNumber} (${items.length} deep dives)`);
        const res = await fetch("/api/generate-glossary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lectureNotes: text,
            weekNumber,
            topic: course.topic,
          }),
        });
        if (!res.ok) return;
        const newTerms: GlossaryEntry[] = await res.json();
        setGlossary(prev => {
          const existing = prev[weekNumber] ?? [];
          const existingNames = new Set(existing.map(e => e.term));
          const unique = newTerms.filter(t => !existingNames.has(t.term));
          if (unique.length === 0) {
            logger.info("CourseView", `Deep-dive glossary for week ${weekNumber}: no new terms`);
            return prev;
          }
          logger.info("CourseView", `Deep-dive glossary for week ${weekNumber}: merged ${unique.length} new terms`);
          return { ...prev, [weekNumber]: [...existing, ...unique] };
        });
      } catch {
        logger.error("CourseView", `Error fetching deep-dive glossary for week ${weekNumber}`);
        // Allow retry on next render
        ddGlossaryFetched.current.delete(weekNumber);
      }
    },
    [course.topic]
  );

  useEffect(() => {
    if (deepDiveMode !== "separate") return;
    for (const [weekNum, items] of Object.entries(deepDives)) {
      const wn = Number(weekNum);
      if (ddGlossaryFetched.current.has(wn)) continue;
      if (!items.length) continue;
      ddGlossaryFetched.current.add(wn);
      mergeDeepDiveGlossary(wn, items);
    }
  }, [deepDives, mergeDeepDiveGlossary]);

  // Scroll-triggered priority fetch: when the user scrolls to an unloaded week, request it
  useEffect(() => {
    if (!weekStatus || !onRequestWeek) return;
    const week = course.weeks[activeIndex];
    if (week && weekStatus[week.weekNumber] === "skeleton") {
      onRequestWeek(week.weekNumber);
    }
  }, [activeIndex, weekStatus, onRequestWeek, course.weeks]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <CourseHeader course={course} onReset={onReset} />
      <WeekDeck
        weeks={course.weeks}
        glossary={glossary}
        deepDives={deepDives}
        activeIndex={activeIndex}
        setRef={setRef}
        topic={course.topic}
        weekStatus={weekStatus}
        sentinelRef={sentinelRef}
        isGeneratingNext={isGeneratingNext}
        nextTopicPreview={nextTopicPreview}
        onTriggerNext={onTriggerNext}
      />
      <ExportPDFButton
        course={course}
        disabled={weekStatus ? Object.values(weekStatus).some(s => s !== "loaded") : false}
      />
    </div>
  );
}
