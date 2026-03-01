import { Course, Week } from "@/types/course";
import { logger } from "@/lib/logger";

export interface NextWeekRecommendation {
  nextTopicTitle: string;
  nextTopicOverview: string;
  rationale: string;
}

export interface GenerateNextWeekResult {
  recommendation: NextWeekRecommendation;
  weekData: Week;
}

/**
 * Pure async function that runs the recommend → generate pipeline for a single week.
 * No side effects — returns the recommendation and week data for the caller to handle.
 */
export async function generateNextWeek(params: {
  course: Course;
  nextWeekNumber: number;
  signal: AbortSignal;
}): Promise<GenerateNextWeekResult> {
  const { course, nextWeekNumber, signal } = params;

  // Build weeksCovered summary — only include fully loaded weeks
  const weeksCovered = course.weeks
    .filter(w => w.lectureNotes)
    .map(w => ({
      weekNumber: w.weekNumber,
      title: w.title,
      overview: w.overview,
    }));

  // Step 1: Recommend next topic
  logger.info("generateNextWeek", `Recommending topic for week ${nextWeekNumber}`);
  const recRes = await fetch("/api/recommend-next-topic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: course.topic,
      level: course.level,
      weeksCovered,
    }),
    signal,
  });

  if (!recRes.ok) {
    const errData = await recRes.json().catch(() => ({}));
    throw new Error(errData.error || `Recommend API returned ${recRes.status}`);
  }

  const recommendation: NextWeekRecommendation = await recRes.json();
  logger.info("generateNextWeek", `Recommended: "${recommendation.nextTopicTitle}" — ${recommendation.rationale}`);

  // Step 2: Generate full content
  const courseOutline = course.weeks
    .map(w => `Week ${w.weekNumber}: ${w.title} — ${w.overview}`)
    .join("\n");

  const nextTopicContext = `Title: ${recommendation.nextTopicTitle}\nOverview: ${recommendation.nextTopicOverview}`;

  const genRes = await fetch("/api/generate-course", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: course.topic,
      level: course.level,
      weekStart: nextWeekNumber,
      weekEnd: nextWeekNumber,
      courseOutline,
      nextTopicContext,
    }),
    signal,
  });

  if (!genRes.ok) {
    const errData = await genRes.json().catch(() => ({}));
    throw new Error(errData.error || `Generate API returned ${genRes.status}`);
  }

  const { raw } = await genRes.json();
  const parsed = JSON.parse(raw);
  const weekData: Week = (parsed.weeks ?? [])[0];

  if (!weekData) {
    throw new Error("Week generation returned no data");
  }

  // Force correct weekNumber
  weekData.weekNumber = nextWeekNumber;

  return { recommendation, weekData };
}
