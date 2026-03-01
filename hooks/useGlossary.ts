import { useEffect, useState } from "react";
import { Week, GlossaryEntry } from "@/types/course";
import { logger } from "@/lib/logger";

export function useGlossary(weeks: Week[]) {
  const [glossary, setGlossary] = useState<Record<number, GlossaryEntry[]>>({});

  useEffect(() => {
    if (weeks.length === 0) return;

    weeks.forEach(async (week) => {
      if (!week.lectureNotes) return;
      try {
        logger.info("useGlossary", `Fetching glossary for week ${week.weekNumber}`);
        const res = await fetch("/api/generate-glossary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lectureNotes: week.lectureNotes }),
        });
        if (!res.ok) return;
        const terms: GlossaryEntry[] = await res.json();
        logger.info("useGlossary", `Glossary loaded for week ${week.weekNumber} (${terms.length} terms)`);
        setGlossary((prev) => ({ ...prev, [week.weekNumber]: terms }));
      } catch {
        logger.error("useGlossary", `Error fetching glossary for week ${week.weekNumber}`);
      }
    });
  }, [weeks]);

  return glossary;
}
