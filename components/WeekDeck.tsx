"use client";

import { useRef } from "react";
import { Week, GlossaryEntry, DeepDive } from "@/types/course";
import { WeekCard } from "./WeekCard";
import { useActiveWeek } from "@/hooks/useActiveWeek";

interface Props {
  weeks: Week[];
  glossary: Record<number, GlossaryEntry[]>;
  deepDives: Record<number, DeepDive[]>;
}

export function WeekDeck({ weeks, glossary, deepDives }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { activeIndex, setRef } = useActiveWeek(weeks.length);

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
        />
      ))}
    </div>
  );
}
