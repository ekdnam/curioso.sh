import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { logger } from "@/lib/logger";
import { timedGenerate } from "@/lib/timedGenerate";
import { getCached, setCache } from "@/lib/cache";
import { Level } from "@/types/course";
import { SchemaType, type Schema } from "@google/generative-ai";

const SYSTEM_INSTRUCTION =
  "You are an expert curriculum designer who creates rigorous university-level course syllabi modeled after premier universities like Stanford and UCSD.";

const LEVEL_CALIBRATION = `Level calibration:
- Beginner: Assume no prior domain knowledge, start from fundamentals
- Intermediate: Assume 1-2 years experience, skip basics, go deep
- Advanced: Assume expert practitioners, focus on research frontiers and tradeoffs`;

const SKELETON_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    courseName: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    weeks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          weekNumber: { type: SchemaType.INTEGER },
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
        },
        required: ["weekNumber", "title", "description"],
      },
    },
  },
  required: ["courseName", "description", "weeks"],
};

export async function POST(req: NextRequest) {
  try {
    const { topic, level } = (await req.json()) as {
      topic: string;
      level: Level;
    };

    if (!topic || !level) {
      return NextResponse.json(
        { error: "topic and level are required" },
        { status: 400 }
      );
    }

    // Check cache
    const cached = getCached<{ courseName: string; description: string; weeks: { weekNumber: number; title: string; description: string }[] }>(
      "skeleton", topic, "outline"
    );
    if (cached) {
      return NextResponse.json(cached);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SKELETON_SCHEMA,
        maxOutputTokens: 2048,
      },
    });

    const prompt = `Design a 10-week university-style course on: "${topic}"
Difficulty level: ${level}

${LEVEL_CALIBRATION}

Generate ONLY the course metadata (courseName, description) and a brief outline: for each of the 10 weeks, provide a weekNumber, title, and a 1-2 sentence description of what the week covers. Do NOT generate lecture notes, readings, or other detailed content.`;

    logger.info("generate-skeleton", `Generating skeleton for "${topic}"`);
    const result = await timedGenerate("generate-skeleton", () =>
      model.generateContent(prompt)
    );
    const text = result.response.text();
    const parsed = JSON.parse(text);

    // Cache the result
    setCache("skeleton", topic, "outline", parsed);

    logger.info("generate-skeleton", `Skeleton generated — ${parsed.weeks?.length ?? 0} weeks`);
    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("generate-skeleton", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
