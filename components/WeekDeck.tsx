"use client";

import { useRef } from "react";
import { Week, GlossaryEntry, DeepDiveSummary } from "@/types/course";
import { WeekCard } from "./WeekCard";

interface Props {
  weeks: Week[];
  glossary: Record<number, GlossaryEntry[]>;
  deepDives: Record<number, DeepDiveSummary[]>;
  activeIndex: number;
  setRef: (i: number) => (el: HTMLDivElement | null) => void;
  topic: string;
}

export function WeekDeck({ weeks, glossary, deepDives, activeIndex, setRef, topic }: Props) {
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
      {weeks.map((week, i) => (
        <WeekCard
          key={week.weekNumber}
          week={week}
          prevWeek={weeks[i - 1]}
          nextWeek={weeks[i + 1]}
          isActive={i === activeIndex}
          cardRef={setRef(i)}
          glossary={glossary[week.weekNumber] ?? []}
          deepDives={deepDives[week.weekNumber] ?? null}
          topic={topic}
        />
      ))}
    </div>
  );
}
