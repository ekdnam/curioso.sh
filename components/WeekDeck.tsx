"use client";

import { useRef, RefObject } from "react";
import { Week, GlossaryEntry, DeepDiveSummary } from "@/types/course";
import { WeekCard } from "./WeekCard";
import { SkeletonWeekCard } from "./SkeletonWeekCard";
import { InfiniteScrollSentinel } from "./InfiniteScrollSentinel";
import { deepDiveMode } from "@/lib/config";

interface Props {
  weeks: Week[];
  glossary: Record<number, GlossaryEntry[]>;
  deepDives: Record<number, DeepDiveSummary[]>;
  activeIndex: number;
  setRef: (i: number) => (el: HTMLDivElement | null) => void;
  topic: string;
  weekStatus?: Record<number, "skeleton" | "loading" | "loaded">;
  sentinelRef?: RefObject<HTMLDivElement | null>;
  isGeneratingNext?: boolean;
  nextTopicPreview?: { title: string; overview: string } | null;
  onTriggerNext?: () => void;
}

export function WeekDeck({
  weeks, glossary, deepDives, activeIndex, setRef, topic, weekStatus,
  sentinelRef, isGeneratingNext, nextTopicPreview, onTriggerNext,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="overflow-y-scroll"
      style={{
        height: "calc(100vh - 73px)",
        scrollSnapType: "y mandatory",
      }}
    >
      {weeks.map((week, i) => {
        const status = weekStatus?.[week.weekNumber];
        if (status && status !== "loaded") {
          return (
            <SkeletonWeekCard
              key={week.weekNumber}
              week={week}
              prevWeek={weeks[i - 1]}
              nextWeek={weeks[i + 1]}
              isActive={i === activeIndex}
              cardRef={setRef(i)}
              isLoading={status === "loading"}
            />
          );
        }
        return (
          <WeekCard
            key={week.weekNumber}
            week={week}
            prevWeek={weeks[i - 1]}
            nextWeek={weeks[i + 1]}
            isActive={i === activeIndex}
            cardRef={setRef(i)}
            glossary={glossary[week.weekNumber] ?? []}
            deepDives={
              deepDiveMode === "separate"
                ? deepDives[week.weekNumber] ?? null
                : week.deepDives ?? []
            }
            topic={topic}
          />
        );
      })}
      {sentinelRef && onTriggerNext && (
        <InfiniteScrollSentinel
          sentinelRef={sentinelRef}
          isGenerating={isGeneratingNext ?? false}
          nextTopicPreview={nextTopicPreview ?? null}
          onTrigger={onTriggerNext}
        />
      )}
    </div>
  );
}
