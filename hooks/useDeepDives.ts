import { useEffect, useState } from "react";
import { Week, DeepDive } from "@/types/course";
import { logger } from "@/lib/logger";

export function useDeepDives(weeks: Week[]) {
  const [deepDives, setDeepDives] = useState<Record<number, DeepDive[]>>({});

  useEffect(() => {
    if (weeks.length === 0) return;

    weeks.forEach(async (week) => {
      if (!week.lectureNotes) return;
      try {
        logger.info("useDeepDives", `Fetching deep dives for week ${week.weekNumber}`);
        const res = await fetch("/api/generate-deep-dives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lectureNotes: week.lectureNotes,
            weekTitle: week.title,
          }),
        });
        if (!res.ok) return;
        const items: DeepDive[] = await res.json();
        logger.info("useDeepDives", `Deep dives loaded for week ${week.weekNumber} (${items.length} items)`);
        setDeepDives((prev) => ({ ...prev, [week.weekNumber]: items }));
      } catch {
        logger.error("useDeepDives", `Error fetching deep dives for week ${week.weekNumber}`);
      }
    });
  }, [weeks]);

  return deepDives;
}
