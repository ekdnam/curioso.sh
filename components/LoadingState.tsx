"use client";

import { useState, useEffect } from "react";
import { LoadingStage } from "@/hooks/useGenerateCourse";
import { ProgressiveLoadingStage } from "@/hooks/useProgressiveCourse";
import { CourseSkeleton } from "@/types/course";

type AnyStage = LoadingStage | ProgressiveLoadingStage;

interface Props {
  stage: AnyStage;
  topic: string;
  skeleton?: CourseSkeleton;
}

const STAGE_LABELS: Record<AnyStage, string> = {
  refining: "Understanding your topic",
  "generating-skeleton": "Designing course structure",
  "generating-week-1": "Building first week",
  "generating-course": "Generating course",
  "generating-weeks-1-2": "Generating first weeks",
  "generating-glossary": "Generating glossary",
  "generating-remaining": "Building remaining curriculum",
};

export function LoadingState({ stage, topic, skeleton }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-6 bg-white">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-gray-900">{skeleton?.courseName ?? topic}</h2>
        {skeleton?.description && (
          <p className="text-gray-500 text-sm max-w-md mx-auto">{skeleton.description}</p>
        )}
        <p className="text-blue-600 text-sm font-medium">{STAGE_LABELS[stage]}&hellip;</p>
        <p className="text-gray-400 text-xs">{elapsed}s elapsed</p>
      </div>

      <div className="w-full max-w-lg space-y-3">
        {skeleton ? (
          skeleton.weeks.map((w, i) => (
            <div
              key={w.weekNumber}
              className={`rounded-xl border p-5 space-y-2 transition-all duration-300 ${
                i === 0 && stage === "generating-week-1"
                  ? "border-blue-200 bg-blue-50 animate-pulse"
                  : "border-gray-200 bg-gray-50"
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-600">Week {w.weekNumber}</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{w.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{w.description}</p>
            </div>
          ))
        ) : (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-3 w-16 rounded bg-gray-200" />
              <div className="h-5 w-2/3 rounded bg-gray-200" />
              <div className="h-3 w-full rounded bg-gray-200" />
              <div className="h-3 w-4/5 rounded bg-gray-200" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
