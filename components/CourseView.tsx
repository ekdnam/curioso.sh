"use client";

import { Course } from "@/types/course";
import { CourseHeader } from "./CourseHeader";
import { WeekDeck } from "./WeekDeck";
import { useGlossary } from "@/hooks/useGlossary";
import { useDeepDives } from "@/hooks/useDeepDives";

interface Props {
  course: Course;
  onReset: () => void;
}

export function CourseView({ course, onReset }: Props) {
  const glossary = useGlossary(course.weeks);
  const deepDives = useDeepDives(course.weeks);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <CourseHeader course={course} onReset={onReset} />
      <WeekDeck weeks={course.weeks} glossary={glossary} deepDives={deepDives} />
    </div>
  );
}
