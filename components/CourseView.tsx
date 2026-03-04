"use client";

import { useMemo, useState, useEffect, useRef, useCallback, RefObject } from "react";
import { Course, DeepDiveSummary, GlossaryEntry } from "@/types/course";
import { CourseHeader } from "./CourseHeader";
import { WeekDeck } from "./WeekDeck";
import { useDeepDives } from "@/hooks/useDeepDives";
import { useActiveWeek } from "@/hooks/useActiveWeek";
import { ExportPDFButton } from "./ExportPDFButton";
import { deepDiveMode } from "@/lib/config";
import { fetchGlossaryForWeek, collectKnownTerms } from "@/lib/fetchGlossary";
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
  onScrollVelocityRecord?: (weekIndex: number) => void;
}

export function CourseView({
  course, onReset, weekStatus, onRequestWeek,
  sentinelRef, isGeneratingNext, nextTopicPreview, onTriggerNext,
  onScrollVelocityRecord,
}: Props) {
  // Count loaded weeks so the IntersectionObserver re-attaches when skeleton→loaded swaps DOM elements
  const loadedCount = weekStatus
    ? Object.values(weekStatus).filter(s => s === "loaded").length
    : course.weeks.length;
  const { activeIndex, setRef } = useActiveWeek(course.weeks.length, loadedCount);

  // Report scroll velocity
  useEffect(() => {
    onScrollVelocityRecord?.(activeIndex);
  }, [activeIndex, onScrollVelocityRecord]);

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

  // Viewport-gated glossary: fetch glossary for activeIndex and activeIndex+1
  const glossaryFetchedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const weekIndices = [activeIndex, activeIndex + 1];
    for (const idx of weekIndices) {
      const week = course.weeks[idx];
      if (!week) continue;
      // Only fetch if week has lectureNotes but no glossary yet, and not already fetching
      if (!week.lectureNotes) continue;
      if (week.glossary && week.glossary.length > 0) continue;
      if (glossary[week.weekNumber]?.length > 0) continue;
      if (glossaryFetchedRef.current.has(week.weekNumber)) continue;

      glossaryFetchedRef.current.add(week.weekNumber);

      const knownTerms = collectKnownTerms(course.weeks);
      const controller = new AbortController();
      fetchGlossaryForWeek(week, course.topic, controller.signal, knownTerms)
        .then(terms => {
          if (terms.length > 0) {
            setGlossary(prev => ({ ...prev, [week.weekNumber]: terms }));
          }
        })
        .catch(() => {
          // Allow retry on next viewport enter
          glossaryFetchedRef.current.delete(week.weekNumber);
        });
    }
  }, [activeIndex, course.weeks, course.topic, glossary]);

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
