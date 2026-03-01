"use client";

import { CourseForm } from "@/components/CourseForm";
import { CourseView } from "@/components/CourseView";
import { LoadingState } from "@/components/LoadingState";
import { useGenerateCourse } from "@/hooks/useGenerateCourse";

export default function HomePage() {
  const { state, generate, reset } = useGenerateCourse();

  if (state.status === "loading") {
    return <LoadingState stage={state.stage} topic={state.topic} />;
  }

  if (state.status === "success") {
    return <CourseView course={state.course} onReset={reset} />;
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
