"use client";

import { Course } from "@/types/course";
import { CourseHeader } from "./CourseHeader";
import { WeekDeck } from "./WeekDeck";
import { useGlossary } from "@/hooks/useGlossary";
import { useDeepDives } from "@/hooks/useDeepDives";
import { useActiveWeek } from "@/hooks/useActiveWeek";
import { ExportPDFButton } from "./ExportPDFButton";

interface Props {
  course: Course;
  onReset: () => void;
}

export function CourseView({ course, onReset }: Props) {
  const { activeIndex, setRef } = useActiveWeek(course.weeks.length);
  const glossary = useGlossary(course.weeks, course.topic);
  const deepDives = useDeepDives(course.weeks, course.topic);

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
