"use client";

import { CourseForm } from "@/components/CourseForm";
import { CourseView } from "@/components/CourseView";
import { LoadingState } from "@/components/LoadingState";
import { progressiveLoading, infiniteScroll as infiniteScrollEnabled } from "@/lib/config";
import { useGenerateCourse } from "@/hooks/useGenerateCourse";
import { useProgressiveCourse } from "@/hooks/useProgressiveCourse";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

function useHook() {
  const legacy = useGenerateCourse();
  const progressive = useProgressiveCourse();
  return progressiveLoading ? progressive : legacy;
}

export default function HomePage() {
  const { state, generate, reset, ...rest } = useHook();
  const requestWeek = "requestWeek" in rest ? rest.requestWeek : undefined;
  const appendWeek = "appendWeek" in rest ? rest.appendWeek : undefined;
  const updateWeek = "updateWeek" in rest ? rest.updateWeek : undefined;
  const setWeekStatus = "setWeekStatus" in rest ? rest.setWeekStatus : undefined;
  const initialLoadComplete = "initialLoadComplete" in rest ? rest.initialLoadComplete : false;

  const course = state.status === "success" ? state.course : null;

  const infiniteScrollState = useInfiniteScroll({
    enabled: infiniteScrollEnabled && initialLoadComplete && !!appendWeek,
    course,
    appendWeek: appendWeek ?? (() => {}),
    updateWeek: updateWeek ?? (() => {}),
    setWeekStatus: setWeekStatus ?? (() => {}),
  });

  const handleReset = () => {
    infiniteScrollState.cancel();
    reset();
  };

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
    const showSentinel = infiniteScrollEnabled && initialLoadComplete;
    return (
      <CourseView
        course={state.course}
        onReset={handleReset}
        weekStatus={weekStatus}
        onRequestWeek={requestWeek}
        sentinelRef={showSentinel ? infiniteScrollState.sentinelRef : undefined}
        isGeneratingNext={infiniteScrollState.isGeneratingNext}
        nextTopicPreview={infiniteScrollState.nextTopicPreview}
        onTriggerNext={infiniteScrollState.triggerNext}
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
