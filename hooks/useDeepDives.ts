import { useEffect, useRef, useState } from "react";
import { Week, DeepDiveSummary } from "@/types/course";
import { logger } from "@/lib/logger";

const STAGGER_MS = 500;

export function useDeepDives(weeks: Week[], topic: string) {
  const [deepDives, setDeepDives] = useState<Record<number, DeepDiveSummary[]>>({});
  const fetchedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const controllers: AbortController[] = [];
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    weeks.forEach((week, i) => {
      if (!week.lectureNotes) return;
      if (fetchedRef.current.has(week.weekNumber)) return;
      fetchedRef.current.add(week.weekNumber);

      const controller = new AbortController();
      controllers.push(controller);

      const timeout = setTimeout(() => {
        (async () => {
          try {
            logger.info("useDeepDives", `Fetching summaries for week ${week.weekNumber}`);
            const res = await fetch("/api/generate-deep-dive-summaries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lectureNotes: week.lectureNotes,
                weekTitle: week.title,
                weekNumber: week.weekNumber,
                topic,
              }),
              signal: controller.signal,
            });
            if (!res.ok) return;
            const items: DeepDiveSummary[] = await res.json();
            logger.info("useDeepDives", `Summaries loaded for week ${week.weekNumber} (${items.length} items)`);
            setDeepDives((prev) => ({ ...prev, [week.weekNumber]: items }));
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") return;
            fetchedRef.current.delete(week.weekNumber);
            logger.error("useDeepDives", `Error fetching summaries for week ${week.weekNumber}`);
          }
        })();
      }, i * STAGGER_MS);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(clearTimeout);
      controllers.forEach((c) => c.abort());
    };
  }, [weeks, topic]);

  return deepDives;
}
