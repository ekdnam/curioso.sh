import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { geminiModel } from "@/lib/config";
import { logger } from "@/lib/logger";
import { geminiRetry } from "@/lib/geminiRetry";
import { getCached, setCache } from "@/lib/cache";
import { Level } from "@/types/course";
import { SchemaType, type Schema } from "@google/generative-ai";

const ROADMAP_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    topics: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          weekNumber: { type: SchemaType.NUMBER },
          title: { type: SchemaType.STRING },
          overview: { type: SchemaType.STRING },
        },
        required: ["weekNumber", "title", "overview"],
      },
    },
  },
  required: ["topics"],
};

interface WeekSummary {
  weekNumber: number;
  title: string;
  overview: string;
}

export async function POST(req: NextRequest) {
  try {
    const { topic, level, weeksCovered, count } = (await req.json()) as {
      topic: string;
      level: Level;
      weeksCovered: WeekSummary[];
      count: number;
    };

    logger.info("generate-roadmap", `Request — topic="${topic}", weeksCovered=${weeksCovered.length}, count=${count}`);

    if (!topic || !level || !weeksCovered?.length || !count) {
      return NextResponse.json(
        { error: "topic, level, weeksCovered, and count are required" },
        { status: 400 }
      );
    }

    const lastWeek = weeksCovered[weeksCovered.length - 1].weekNumber;
    const cacheKey = `after-week-${lastWeek}`;

    const cached = getCached<{ topics: WeekSummary[] }>("roadmap", topic, cacheKey);
    if (cached) {
      logger.info("generate-roadmap", `Cache hit for ${cacheKey}`);
      return NextResponse.json(cached);
    }

    const model = genAI.getGenerativeModel({
      model: geminiModel,
      systemInstruction:
        "You are an expert curriculum designer who creates rigorous university-level course syllabi. Your task is to plan a roadmap of upcoming topics for an ongoing learning path.",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: ROADMAP_SCHEMA,
        maxOutputTokens: 4096,
      },
    });

    const weeksList = weeksCovered
      .map(w => `Week ${w.weekNumber}: ${w.title} — ${w.overview}`)
      .join("\n");

    const startWeek = lastWeek + 1;
    const endWeek = lastWeek + count;

    const prompt = `A student is taking a university-style course on: "${topic}"
Difficulty level: ${level}

Here are all the weeks covered so far:
${weeksList}

Plan the NEXT ${count} topics for weeks ${startWeek} through ${endWeek}. Rules:
- Do NOT repeat any topic already covered
- Match the "${level}" difficulty level
- Follow a natural progression from what's been covered
- Each topic should deepen understanding or explore a related area that builds on prior weeks
- Keep titles concise (like a university syllabus week title)
- Each overview should be 1-2 sentences describing what the week covers
- Return topics in order from week ${startWeek} to week ${endWeek}

Return an object with a "topics" array, each entry containing:
- weekNumber: the week number
- title: the week title
- overview: 1-2 sentence overview`;

    const parsed = await geminiRetry("generate-roadmap", async () => {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        logger.error("generate-roadmap", `Malformed JSON from Gemini (${text.length} chars): ${text.slice(0, 500)}`);
        throw parseErr;
      }
    });

    // Ensure correct weekNumbers
    if (parsed.topics) {
      parsed.topics.forEach((t: WeekSummary, i: number) => {
        t.weekNumber = startWeek + i;
      });
    }

    setCache("roadmap", topic, cacheKey, parsed);

    logger.info("generate-roadmap", `Generated ${parsed.topics?.length ?? 0} roadmap topics`);
    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("generate-roadmap", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
