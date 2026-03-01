import { useEffect, useRef, useState } from "react";
import { Week, GlossaryEntry } from "@/types/course";
import { logger } from "@/lib/logger";

export function useGlossary(weeks: Week[], activeWeekNumber: number) {
  const [glossary, setGlossary] = useState<Record<number, GlossaryEntry[]>>({});
  const fetchedRef = useRef<Set<number>>(new Set());
  const weeksRef = useRef(weeks);
  weeksRef.current = weeks;

  useEffect(() => {
    const week = weeksRef.current.find((w) => w.weekNumber === activeWeekNumber);
    if (!week || !week.lectureNotes) return;
    if (fetchedRef.current.has(week.weekNumber)) return;
    fetchedRef.current.add(week.weekNumber);

    const controller = new AbortController();

    (async () => {
      try {
        logger.info("useGlossary", `Fetching glossary for week ${week.weekNumber}`);
        const res = await fetch("/api/generate-glossary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lectureNotes: week.lectureNotes, weekNumber: week.weekNumber }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const terms: GlossaryEntry[] = await res.json();
        logger.info("useGlossary", `Glossary loaded for week ${week.weekNumber} (${terms.length} terms)`);
        setGlossary((prev) => ({ ...prev, [week.weekNumber]: terms }));
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        fetchedRef.current.delete(week.weekNumber);
        logger.error("useGlossary", `Error fetching glossary for week ${week.weekNumber}`);
      }
    })();

    return () => controller.abort();
  }, [activeWeekNumber]);

  return glossary;
}
