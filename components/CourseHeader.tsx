"use client";

import { Course } from "@/types/course";

interface Props {
  course: Course;
  onReset: () => void;
}

export function CourseHeader({ course, onReset }: Props) {
  return (
    <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-6 py-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
            <span className="text-blue-600 font-medium">{course.courseCode}</span>
            <span>·</span>
            <span className="truncate">{course.instructor}</span>
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
