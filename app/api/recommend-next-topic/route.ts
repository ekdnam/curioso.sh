import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { geminiModel } from "@/lib/config";
import { logger } from "@/lib/logger";
import { geminiRetry } from "@/lib/geminiRetry";
import { getCached, setCache } from "@/lib/cache";
import { Level } from "@/types/course";
import { SchemaType, type Schema } from "@google/generative-ai";

const RECOMMEND_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    nextTopicTitle: { type: SchemaType.STRING },
    nextTopicOverview: { type: SchemaType.STRING },
    rationale: { type: SchemaType.STRING },
  },
  required: ["nextTopicTitle", "nextTopicOverview", "rationale"],
};

interface WeekSummary {
  weekNumber: number;
  title: string;
  overview: string;
}

export async function POST(req: NextRequest) {
  try {
    const { topic, level, weeksCovered } = (await req.json()) as {
      topic: string;
      level: Level;
      weeksCovered: WeekSummary[];
    };

    logger.info("recommend-next-topic", `Request — topic="${topic}", weeksCovered=${weeksCovered.length}`);

    if (!topic || !level || !weeksCovered?.length) {
      return NextResponse.json(
        { error: "topic, level, and weeksCovered are required" },
        { status: 400 }
      );
    }

    const lastWeek = weeksCovered[weeksCovered.length - 1].weekNumber;
    const cacheKey = `after-week-${lastWeek}`;

    const cached = getCached<{ nextTopicTitle: string; nextTopicOverview: string; rationale: string }>(
      "recommend", topic, cacheKey
    );
    if (cached) {
      logger.info("recommend-next-topic", `Cache hit for ${cacheKey}`);
      return NextResponse.json(cached);
    }

    const model = genAI.getGenerativeModel({
      model: geminiModel,
      systemInstruction:
        "You are an expert curriculum designer who creates rigorous university-level course syllabi. Your task is to recommend the next logical topic in an ongoing learning path.",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RECOMMEND_SCHEMA,
        maxOutputTokens: 2048,
      },
    });

    const weeksList = weeksCovered
      .map(w => `Week ${w.weekNumber}: ${w.title} — ${w.overview}`)
      .join("\n");

    const prompt = `A student is taking a university-style course on: "${topic}"
Difficulty level: ${level}

Here are all the weeks covered so far:
${weeksList}

Recommend the NEXT topic for week ${lastWeek + 1}. Rules:
- Do NOT repeat any topic already covered
- Match the "${level}" difficulty level
- Follow a natural progression from what's been covered
- The topic should deepen understanding or explore a related area that builds on prior weeks
- Keep the title concise (like a university syllabus week title)
- The overview should be 1-2 sentences describing what the week covers

Return:
- nextTopicTitle: the week title
- nextTopicOverview: 1-2 sentence overview
- rationale: brief explanation of why this topic follows logically`;

    const parsed = await geminiRetry("recommend-next-topic", async () => {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        logger.error("recommend-next-topic", `Malformed JSON from Gemini (${text.length} chars): ${text.slice(0, 500)}`);
        throw parseErr;
      }
    });

    setCache("recommend", topic, cacheKey, parsed);

    logger.info("recommend-next-topic", `Recommended: "${parsed.nextTopicTitle}"`);
    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("recommend-next-topic", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
