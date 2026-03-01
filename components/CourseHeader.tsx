"use client";

import { Course } from "@/types/course";

interface Props {
  course: Course;
  onReset: () => void;
}

const LEVEL_BADGE: Record<string, string> = {
  Beginner: "bg-green-100 text-green-700",
  Intermediate: "bg-amber-100 text-amber-700",
  Advanced: "bg-red-100 text-red-700",
};

export function CourseHeader({ course, onReset }: Props) {
  const badgeCls = LEVEL_BADGE[course.level] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-6 py-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm mb-0.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeCls}`}>
              {course.level}
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500 truncate">{course.topic}</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 truncate">
            {course.courseName}
          </h1>
        </div>

        <button
          onClick={onReset}
          className="shrink-0 text-sm text-gray-500 border border-gray-300 rounded-lg
                     px-3 py-1.5 hover:border-gray-400 hover:text-gray-700 transition whitespace-nowrap"
        >
          ← New course
        </button>
      </div>
    </div>
  );
}
