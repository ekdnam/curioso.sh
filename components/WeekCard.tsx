"use client";

import { useState, memo } from "react";
import { motion } from "framer-motion";
import { Week, Reading, GlossaryEntry, DeepDive, DeepDiveSummary } from "@/types/course";
import { DeepDiveDrawer } from "./DeepDiveDrawer";
import { HighlightedText } from "./HighlightedText";
import { useDeepDiveContent } from "@/hooks/useDeepDiveContent";
import { deepDiveMode } from "@/lib/config";

interface Props {
  week: Week;
  prevWeek?: Week;
  nextWeek?: Week;
  isActive: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  glossary: GlossaryEntry[];
  deepDives: DeepDiveSummary[] | null;
  topic: string;
}

function ReadingItem({ r }: { r: Reading }) {
  return (
    <li>
      <p className="text-gray-900 text-sm font-medium leading-snug">{r.title}</p>
      <p className="text-gray-500 text-xs mt-0.5">{r.author} · {r.year}</p>
      {r.notes && <p className="text-gray-400 text-xs mt-0.5 italic">{r.notes}</p>}
    </li>
  );
}

function DeepDiveSkeleton() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-100 rounded w-full mb-1.5" />
      <div className="h-3 bg-gray-100 rounded w-5/6" />
    </div>
  );
}

export const WeekCard = memo(function WeekCard({ week, prevWeek, nextWeek, isActive, cardRef, glossary, deepDives, topic }: Props) {
  const [openDive, setOpenDive] = useState<DeepDiveSummary | null>(null);

  // In "bundled" mode, fetch content on-demand when a dive is opened
  const { content: fetchedContent, loading: contentLoading } = useDeepDiveContent(
    deepDiveMode === "bundled" && openDive ? openDive.title : null,
    deepDiveMode === "bundled" && openDive ? openDive.summary : null,
    deepDiveMode === "bundled" && openDive ? week.lectureNotes : null,
    topic
  );

  // Resolve what content to show in the drawer
  const drawerContent =
    deepDiveMode === "full" && openDive
      ? (openDive as DeepDive).content
      : deepDiveMode === "bundled"
        ? fetchedContent
        : undefined;

  return (
    <div
      ref={cardRef}
      className="relative flex flex-col"
      style={{ height: "100vh", scrollSnapAlign: "start" }}
    >
      {/* Scroll up hint */}
      <div className={`flex items-center justify-center py-3 border-b border-gray-100 transition-opacity duration-300 ${isActive && prevWeek ? "opacity-100" : "opacity-0"}`}>
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          ↑ <span className="font-medium text-gray-500">Week {prevWeek?.weekNumber}:</span> {prevWeek?.title}
        </span>
      </div>

      {/* Main content — two column layout */}
      <div className="flex-1 overflow-y-auto flex justify-center">
        <motion.div
          className="flex gap-8 px-6 py-8 w-full max-w-7xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: isActive ? 1 : 0.3, y: isActive ? 0 : 16 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Left — main content (keeps original width) */}
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

            {/* Lecture notes */}
            {week.lectureNotes && (
              <section className="mb-8">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Lecture Notes
                </h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line max-w-2xl">
                  <HighlightedText text={week.lectureNotes} glossary={glossary} />
                </div>
              </section>
            )}

          </div>

          {/* Right sidebar — Deep Dives + Readings */}
          <div className="hidden lg:flex flex-col w-72 shrink-0 gap-3 pt-8">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Deep Dives
            </h3>
            {deepDives === null ? (
              <>
                <DeepDiveSkeleton />
                <DeepDiveSkeleton />
                <DeepDiveSkeleton />
              </>
            ) : deepDives.length === 0 ? null : (
              deepDives.map((dive, i) => (
                <button
                  key={i}
                  onClick={() => setOpenDive(dive)}
                  className="text-left rounded-xl border border-gray-100 bg-white p-4 hover:border-blue-200 hover:shadow-md transition-all group"
                >
                  <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 leading-snug">
                    {dive.title}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">
                    {dive.summary}
                  </p>
                  <span className="text-xs text-blue-500 mt-2 inline-block font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Read more &rarr;
                  </span>
                </button>
              ))
            )}

            {/* Required Reading */}
            {week.requiredReading.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 mt-4">
                  Required Reading
                </h3>
                <ul className="space-y-3">
                  {week.requiredReading.map((r, i) => (
                    <ReadingItem key={i} r={r} />
                  ))}
                </ul>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Scroll down hint — prominent version */}
      <div className={`flex items-center justify-center py-4 border-t border-gray-100 transition-opacity duration-300 ${isActive && nextWeek ? "opacity-100" : "opacity-0"}`}>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            Up Next
          </span>
          <span className="text-sm text-gray-700 font-medium">
            Week {nextWeek?.weekNumber} &mdash; {nextWeek?.title}
          </span>
          <motion.span
            className="text-gray-400 text-lg"
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            &#8595;
          </motion.span>
        </div>
      </div>

      <DeepDiveDrawer
        deepDive={openDive}
        onClose={() => setOpenDive(null)}
        contentOverride={drawerContent}
        loading={deepDiveMode === "bundled" && contentLoading}
        glossary={glossary}
      />
    </div>
  );
});
