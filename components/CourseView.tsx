"use client";

import { Course } from "@/types/course";
import { CourseHeader } from "./CourseHeader";
import { WeekDeck } from "./WeekDeck";

interface Props {
  course: Course;
  onReset: () => void;
}

export function CourseView({ course, onReset }: Props) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <CourseHeader course={course} onReset={onReset} />
      <WeekDeck weeks={course.weeks} />
    </div>
  );
}
