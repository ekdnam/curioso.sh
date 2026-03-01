"use client";

import { RefObject } from "react";

interface Props {
  sentinelRef: RefObject<HTMLDivElement | null>;
  isGenerating: boolean;
  nextTopicPreview: { title: string; overview: string } | null;
  onTrigger: () => void;
}

export function InfiniteScrollSentinel({ sentinelRef, isGenerating, nextTopicPreview, onTrigger }: Props) {
  return (
    <div
      ref={sentinelRef}
      className="flex flex-col items-center justify-center py-16 px-4"
      style={{ minHeight: "30vh" }}
    >
      {isGenerating ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: "300ms" }} />
          </div>
          {nextTopicPreview ? (
            <>
              <p className="text-sm font-medium text-indigo-600">
                Generating: {nextTopicPreview.title}
              </p>
              <p className="text-xs text-gray-500 max-w-md">
                {nextTopicPreview.overview}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Finding the next topic...</p>
          )}
        </div>
      ) : (
        <button
          onClick={onTrigger}
          className="flex flex-col items-center gap-3 text-gray-400 hover:text-indigo-500 transition-colors cursor-pointer group"
        >
          <p className="text-sm">Keep scrolling to continue learning...</p>
          <svg
            className="w-5 h-5 animate-bounce group-hover:text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}
