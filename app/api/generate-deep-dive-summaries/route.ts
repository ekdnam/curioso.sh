import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { geminiModel } from "@/lib/config";
import { logger } from "@/lib/logger";
import { geminiRetry } from "@/lib/geminiRetry";
import { getCached, setCache } from "@/lib/cache";
import { SchemaType, type Schema } from "@google/generative-ai";

const SUMMARIES_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    deepDives: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          summary: { type: SchemaType.STRING },
        },
        required: ["title", "summary"],
      },
    },
  },
  required: ["deepDives"],
};

export async function POST(req: NextRequest) {
  try {
    const { lectureNotes, weekTitle, weekNumber, topic } = (await req.json()) as {
      lectureNotes: string;
      weekTitle: string;
      weekNumber?: number;
      topic?: string;
    };

    logger.info(
      "generate-deep-dive-summaries",
      `Request received — week=${weekNumber ?? "?"}, weekTitle="${weekTitle}", lectureNotes length=${lectureNotes?.length ?? 0}`
    );

    if (!lectureNotes) {
      return NextResponse.json(
        { error: "lectureNotes is required" },
        { status: 400 }
      );
    }

    if (topic) {
      const cached = getCached<{ deepDives: { title: string; summary: string }[] }>(
        "dd-summaries", topic, `week-${weekNumber ?? 0}`
      );
      if (cached) {
        return NextResponse.json(cached.deepDives);
      }
    }

    const model = genAI.getGenerativeModel({
      model: geminiModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SUMMARIES_SCHEMA,
      },
    });

    const prompt = `Generate 2-3 deep dive topics related to the lecture "${weekTitle}".

Each deep dive should pick a specific technical concept, mechanism, or real-world application from the lecture.

Rules:
- Title: short, descriptive, no clickbait
- Summary: 1 sentence stating what the deep dive covers

Only return titles and summaries. Do NOT generate full content.

Lecture notes:
${lectureNotes}`;

    logger.info("generate-deep-dive-summaries", `Gemini call starting — week=${weekNumber ?? "?"}`);

    const parsed = await geminiRetry("generate-deep-dive-summaries", async () => {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text);
    });

    if (topic) {
      setCache("dd-summaries", topic, `week-${weekNumber ?? 0}`, parsed);
    }

    logger.info(
      "generate-deep-dive-summaries",
      `week=${weekNumber ?? "?"} — ${parsed.deepDives.length} summaries generated`
    );
    return NextResponse.json(parsed.deepDives);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("generate-deep-dive-summaries", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
