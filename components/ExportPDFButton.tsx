"use client";

import { Course } from "@/types/course";
import { exportCoursePDF } from "@/lib/exportPDF";

interface Props {
  course: Course;
}

export function ExportPDFButton({ course }: Props) {
  return (
    <button
      onClick={() => exportCoursePDF(course)}
      className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-xl hover:bg-neutral-800 transition-colors cursor-pointer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export PDF
    </button>
  );
}
