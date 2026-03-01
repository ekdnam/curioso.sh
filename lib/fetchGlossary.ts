import { Week, DeepDive, GlossaryEntry } from "@/types/course";
import { logger } from "@/lib/logger";

export async function fetchGlossaryForWeek(
  week: Week,
  topic: string,
  signal: AbortSignal
): Promise<GlossaryEntry[]> {
  if (!week.lectureNotes) return [];
  try {
    let text = week.lectureNotes;
    if (week.deepDives?.length) {
      const ddText = week.deepDives
        .map(dd => `${dd.title}\n${dd.summary}${"content" in dd ? "\n" + (dd as DeepDive).content : ""}`)
        .join("\n\n");
      text += "\n\n" + ddText;
    }
    const t0 = performance.now();
    const res = await fetch("/api/generate-glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lectureNotes: text, weekNumber: week.weekNumber, topic }),
      signal,
    });
    if (!res.ok) return [];
    const terms: GlossaryEntry[] = await res.json();
    logger.perf("fetchGlossary", `glossary week ${week.weekNumber}`, Math.round(performance.now() - t0));
    return terms;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    logger.error("fetchGlossary", `Error fetching glossary for week ${week.weekNumber}`);
    return [];
  }
}
