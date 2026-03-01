"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { DeepDive, DeepDiveSummary, GlossaryEntry } from "@/types/course";
import { HighlightedText } from "./HighlightedText";

interface Props {
  deepDive: DeepDiveSummary | null;
  onClose: () => void;
  contentOverride?: string | null;
  loading?: boolean;
  glossary?: GlossaryEntry[];
}

export function DeepDiveDrawer({ deepDive, onClose, contentOverride, loading, glossary }: Props) {
  useEffect(() => {
    if (!deepDive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [deepDive, onClose]);

  return createPortal(
    <AnimatePresence>
      {deepDive && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/30 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
              <div>
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                  Deep Dive
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-1 leading-tight">
                  {deepDive.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 mt-1 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M15 5L5 15M5 5l10 10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <p className="text-sm text-gray-500 italic mb-4 leading-relaxed">
                {deepDive.summary}
              </p>
              {loading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-5/6" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-4/6" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              ) : (
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  <HighlightedText
                    text={contentOverride !== undefined ? contentOverride ?? "" : (deepDive as DeepDive).content}
                    glossary={glossary ?? []}
                  />
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
