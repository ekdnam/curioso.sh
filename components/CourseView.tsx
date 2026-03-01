"use client";

import { useMemo } from "react";
import { Course, GlossaryEntry } from "@/types/course";
import { CourseHeader } from "./CourseHeader";
import { WeekDeck } from "./WeekDeck";
import { useDeepDives } from "@/hooks/useDeepDives";
import { useActiveWeek } from "@/hooks/useActiveWeek";
import { ExportPDFButton } from "./ExportPDFButton";
import { deepDiveMode } from "@/lib/config";

interface Props {
  course: Course;
  onReset: () => void;
}

export function CourseView({ course, onReset }: Props) {
  const { activeIndex, setRef } = useActiveWeek(course.weeks.length);
  const glossary = useMemo(() => {
    const record: Record<number, GlossaryEntry[]> = {};
    for (const week of course.weeks) {
      if (week.glossary) {
        record[week.weekNumber] = week.glossary;
      }
    }
    return record;
  }, [course.weeks]);
  const fetchedDeepDives = useDeepDives(
    deepDiveMode === "separate" ? course.weeks : [],
    course.topic
  );
  const deepDives = deepDiveMode === "separate" ? fetchedDeepDives : {};

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
      />
      <ExportPDFButton course={course} />
    </div>
  );
}
