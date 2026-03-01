"use client";

import { CourseForm } from "@/components/CourseForm";
import { CourseView } from "@/components/CourseView";
import { LoadingState } from "@/components/LoadingState";
import { progressiveLoading } from "@/lib/config";
import { useGenerateCourse } from "@/hooks/useGenerateCourse";
import { useProgressiveCourse } from "@/hooks/useProgressiveCourse";

function useHook() {
  const legacy = useGenerateCourse();
  const progressive = useProgressiveCourse();
  return progressiveLoading ? progressive : legacy;
}

export default function HomePage() {
  const { state, generate, reset, ...rest } = useHook();
  const requestWeek = "requestWeek" in rest ? rest.requestWeek : undefined;

  if (state.status === "loading") {
    return (
      <LoadingState
        stage={state.stage}
        topic={state.topic}
        skeleton={"skeleton" in state ? state.skeleton : undefined}
      />
    );
  }

  if (state.status === "success") {
    const weekStatus = "weekStatus" in state ? state.weekStatus : undefined;
    return (
      <CourseView
        course={state.course}
        onReset={reset}
        weekStatus={weekStatus}
        onRequestWeek={requestWeek}
      />
    );
  }

  // state is "idle" | "error" here
  return (
    <>
      <CourseForm onSubmit={generate} />
      {state.status === "error" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                        bg-red-50 border border-red-200 text-red-700
                        rounded-xl px-5 py-3 text-sm max-w-sm text-center shadow-lg">
          {state.message}
        </div>
      )}
    </>
  );
}
