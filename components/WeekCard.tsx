"use client";

import { motion } from "framer-motion";
import { Week, Reading } from "@/types/course";

interface Props {
  week: Week;
  prevWeek?: Week;
  nextWeek?: Week;
  isActive: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
}

const READING_BADGE: Record<string, string> = {
  book:    "bg-green-100 text-green-700",
  paper:   "bg-blue-100 text-blue-700",
  article: "bg-orange-100 text-orange-700",
  chapter: "bg-purple-100 text-purple-700",
};

function ReadingItem({ r }: { r: Reading }) {
  const cls = READING_BADGE[r.type] ?? "bg-gray-100 text-gray-600";
  return (
    <li className="flex gap-3 items-start">
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cls}`}>
        {r.type}
      </span>
      <div>
        <p className="text-gray-900 text-sm font-medium leading-snug">{r.title}</p>
        <p className="text-gray-500 text-xs mt-0.5">{r.author} · {r.year}</p>
        {r.notes && <p className="text-gray-400 text-xs mt-0.5 italic">{r.notes}</p>}
      </div>
    </li>
  );
}

export function WeekCard({ week, prevWeek, nextWeek, isActive, cardRef }: Props) {
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

      {/* Main content */}
      <motion.div
        className="flex-1 overflow-y-auto px-6 py-8 max-w-4xl mx-auto w-full"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: isActive ? 1 : 0.3, y: isActive ? 0 : 16 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
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

        {/* Content grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left col: objectives + prereqs */}
          <div className="space-y-6">
            {week.prerequisites.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Prerequisites
                </h3>
                <ul className="space-y-1.5">
                  {week.prerequisites.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-600">
                      <span className="text-gray-300 shrink-0">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                What You&apos;ll Learn
              </h3>
              <ul className="space-y-2">
                {week.learningObjectives.map((obj, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-blue-500 shrink-0 mt-0.5">✓</span>
                    {obj}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Right col: readings */}
          {week.requiredReading.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Required Reading
              </h3>
              <ul className="space-y-4">
                {week.requiredReading.map((r, i) => (
                  <ReadingItem key={i} r={r} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </motion.div>

      {/* Scroll down hint */}
      <div className={`flex items-center justify-center py-3 border-t border-gray-100 transition-opacity duration-300 ${isActive && nextWeek ? "opacity-100" : "opacity-0"}`}>
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          <span className="font-medium text-gray-500">Week {nextWeek?.weekNumber}:</span> {nextWeek?.title} ↓
        </span>
      </div>
    </div>
  );
}
