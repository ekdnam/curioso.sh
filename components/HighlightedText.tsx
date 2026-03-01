"use client";

import { useRef, useState, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { GlossaryEntry } from "@/types/course";

function GlossaryTooltip({ term, definition, children }: { term: string; definition: string; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <span ref={ref} className="inline" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {pos &&
        createPortal(
          <span
            style={{ top: pos.top, left: pos.left, transform: "translate(-50%, -100%)" }}
            className="fixed w-64 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg z-50 pointer-events-none"
          >
            <span className="font-semibold">{term}</span>
            <span className="block mt-1 font-normal leading-relaxed">{definition}</span>
          </span>,
          document.body,
        )}
    </span>
  );
}

export const HighlightedText = memo(function HighlightedText({ text, glossary }: { text: string; glossary: GlossaryEntry[] }) {
  const { pattern, termMap } = useMemo(() => {
    if (glossary.length === 0) return { pattern: null, termMap: null };
    const sorted = [...glossary].sort((a, b) => b.term.length - a.term.length);
    const escaped = sorted.map((g) => g.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return {
      pattern: new RegExp(`\\b(${escaped.join("|")})\\b`, "gi"),
      termMap: new Map(sorted.map((g) => [g.term.toLowerCase(), g.definition])),
    };
  }, [glossary]);

  const parts = useMemo(() => {
    if (!pattern) return null;
    return text.split(pattern);
  }, [text, pattern]);

  if (!parts || !termMap) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) => {
        const definition = termMap.get(part.toLowerCase());
        if (!definition) return <span key={i}>{part}</span>;
        return (
          <GlossaryTooltip key={i} term={part} definition={definition}>
            <span className="underline decoration-blue-300 decoration-dotted underline-offset-2 cursor-help">
              {part}
            </span>
          </GlossaryTooltip>
        );
      })}
    </>
  );
});
