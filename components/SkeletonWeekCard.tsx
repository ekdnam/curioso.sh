"use client";

import { Week } from "@/types/course";

interface Props {
  week: Week;
  prevWeek?: Week;
  nextWeek?: Week;
  isActive: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  isLoading: boolean;
}

export function SkeletonWeekCard({ week, prevWeek, nextWeek, isActive, cardRef, isLoading }: Props) {
  return (
    <div
      ref={cardRef}
      className="relative flex flex-col"
      style={{ height: "100vh", scrollSnapAlign: "start" }}
    >
      {/* Scroll up hint */}
      <div className={`flex items-center justify-center py-3 border-b border-gray-100 transition-opacity duration-300 ${isActive && prevWeek ? "opacity-100" : "opacity-0"}`}>
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          &uarr; <span className="font-medium text-gray-500">Week {prevWeek?.weekNumber}:</span> {prevWeek?.title}
        </span>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto flex justify-center">
        <div className={`flex gap-8 px-6 py-8 w-full max-w-7xl transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-30"}`}>
          {/* Left — main content */}
          <div className="flex-1 max-w-4xl min-w-0">
            {/* Week label + title */}
            <div className="mb-6">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                Week {week.weekNumber}
              </span>
              <h2 className="text-3xl font-bold text-gray-900 mt-1 leading-tight">
                {week.title}
              </h2>
              <p className="mt-3 text-gray-500 text-base leading-relaxed max-w-2xl">
                {week.overview}
              </p>
            </div>

            {isLoading && (
              <div className="mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs text-blue-600 font-medium">Loading content...</span>
              </div>
            )}

            {/* Skeleton lecture notes */}
            <section className="mb-8 animate-pulse">
              <div className="h-3 w-24 rounded bg-gray-200 mb-3" />
              <div className="space-y-2 max-w-2xl">
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-5/6 rounded bg-gray-100" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-4/5 rounded bg-gray-100" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-3/4 rounded bg-gray-100" />
              </div>
            </section>

            {/* Skeleton grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
              <div className="space-y-6">
                <div>
                  <div className="h-3 w-20 rounded bg-gray-200 mb-3" />
                  <div className="space-y-2">
                    <div className="h-3 w-3/4 rounded bg-gray-100" />
                    <div className="h-3 w-2/3 rounded bg-gray-100" />
                  </div>
                </div>
                <div>
                  <div className="h-3 w-28 rounded bg-gray-200 mb-3" />
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-gray-100" />
                    <div className="h-3 w-5/6 rounded bg-gray-100" />
                    <div className="h-3 w-4/5 rounded bg-gray-100" />
                  </div>
                </div>
              </div>
              <div>
                <div className="h-3 w-28 rounded bg-gray-200 mb-3" />
                <div className="space-y-4">
                  <div className="h-10 w-full rounded bg-gray-100" />
                  <div className="h-10 w-full rounded bg-gray-100" />
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar skeleton */}
          <div className="hidden lg:flex flex-col w-72 shrink-0 gap-3 pt-8 animate-pulse">
            <div className="h-3 w-20 rounded bg-gray-200 mb-1" />
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full mb-1.5" />
              <div className="h-3 bg-gray-100 rounded w-5/6" />
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full mb-1.5" />
              <div className="h-3 bg-gray-100 rounded w-4/5" />
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full mb-1.5" />
              <div className="h-3 bg-gray-100 rounded w-5/6" />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll down hint */}
      <div className={`flex items-center justify-center py-4 border-t border-gray-100 transition-opacity duration-300 ${isActive && nextWeek ? "opacity-100" : "opacity-0"}`}>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            Up Next
          </span>
          <span className="text-sm text-gray-700 font-medium">
            Week {nextWeek?.weekNumber} &mdash; {nextWeek?.title}
          </span>
          <span className="text-gray-400 text-lg">&#8595;</span>
        </div>
      </div>
    </div>
  );
}
