import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { logger } from "@/lib/logger";
import { geminiRetry } from "@/lib/geminiRetry";
import { getCached, setCache } from "@/lib/cache";
import { SchemaType, type Schema } from "@google/generative-ai";

const CONTENT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    content: { type: SchemaType.STRING },
  },
  required: ["content"],
};

export async function POST(req: NextRequest) {
  try {
    const { title, summary, lectureNotes, topic } = (await req.json()) as {
      title: string;
      summary: string;
      lectureNotes: string;
      topic?: string;
    };

    logger.info(
      "generate-deep-dive-content",
      `Request received — title="${title}"`
    );

    if (!title || !summary || !lectureNotes) {
      return NextResponse.json(
        { error: "title, summary, and lectureNotes are required" },
        { status: 400 }
      );
    }

    if (topic) {
      const cached = getCached<{ content: string }>("dd-content", topic, title);
      if (cached) {
        return NextResponse.json({ content: cached.content });
      }
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: CONTENT_SCHEMA,
      },
    });

    const prompt = `Write a detailed explanation for the following deep dive topic.

Title: ${title}
Summary: ${summary}

Rules:
- Write 3-4 paragraphs of direct, factual explanation. Write like a textbook, not a blog. No filler, no rhetorical questions, no "imagine this" storytelling. Just explain the topic clearly.
- Do NOT start paragraphs with "In the world of" or "Have you ever wondered" or similar fluff
- Do NOT use phrases like "it's worth noting", "interestingly enough", "let's explore", "buckle up", "dive in"
- Use concrete examples, numbers, and specifics where possible

Context from the lecture notes:
${lectureNotes}`;

    logger.info("generate-deep-dive-content", `Gemini call starting — title="${title}"`);

    const parsed = await geminiRetry("generate-deep-dive-content", async () => {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text);
    });

    if (topic) {
      setCache("dd-content", topic, title, parsed);
    }

    logger.info("generate-deep-dive-content", `Content generated for "${title}"`);
    return NextResponse.json({ content: parsed.content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("generate-deep-dive-content", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
