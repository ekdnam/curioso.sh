import { useEffect, useRef, useState } from "react";
import { Week, DeepDive } from "@/types/course";
import { logger } from "@/lib/logger";

export function useDeepDives(weeks: Week[], activeWeekNumber: number) {
  const [deepDives, setDeepDives] = useState<Record<number, DeepDive[]>>({});
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
        logger.info("useDeepDives", `Fetching deep dives for week ${week.weekNumber}`);
        const res = await fetch("/api/generate-deep-dives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lectureNotes: week.lectureNotes,
            weekTitle: week.title,
            weekNumber: week.weekNumber,
          }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const items: DeepDive[] = await res.json();
        logger.info("useDeepDives", `Deep dives loaded for week ${week.weekNumber} (${items.length} items)`);
        setDeepDives((prev) => ({ ...prev, [week.weekNumber]: items }));
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        fetchedRef.current.delete(week.weekNumber);
        logger.error("useDeepDives", `Error fetching deep dives for week ${week.weekNumber}`);
      }
    })();

    return () => controller.abort();
  }, [activeWeekNumber]);

  return deepDives;
}
