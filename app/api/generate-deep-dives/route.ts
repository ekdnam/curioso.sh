import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { logger } from "@/lib/logger";
import { SchemaType, type Schema } from "@google/generative-ai";

const DEEP_DIVES_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    deepDives: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          summary: { type: SchemaType.STRING },
          content: { type: SchemaType.STRING },
        },
        required: ["title", "summary", "content"],
      },
    },
  },
  required: ["deepDives"],
};

export async function POST(req: NextRequest) {
  try {
    const { lectureNotes, weekTitle } = (await req.json()) as {
      lectureNotes: string;
      weekTitle: string;
    };

    logger.info(
      "generate-deep-dives",
      `Request received — weekTitle="${weekTitle}", lectureNotes length=${lectureNotes?.length ?? 0}`
    );

    if (!lectureNotes) {
      return NextResponse.json(
        { error: "lectureNotes is required" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: DEEP_DIVES_SCHEMA,
      },
    });

    const prompt = `You are an expert educator writing engaging "deep dive" mini-blog posts for students studying "${weekTitle}".

Based on the lecture notes below, generate 2-3 deep dive topics. Each deep dive should:
- Explore an interesting tangent, real-world application, historical context, or advanced concept related to the lecture
- Have a catchy, curiosity-driven title
- Include a 1-2 sentence summary that hooks the reader
- Include 3-4 paragraphs of blog-style content that is informative, engaging, and accessible

Write in a conversational but educational tone. Make the content genuinely interesting — the kind of thing a curious student would love to read.

Lecture notes:
${lectureNotes}`;

    logger.info("generate-deep-dives", "Gemini call starting");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    logger.info(
      "generate-deep-dives",
      `Deep dives generated: ${parsed.deepDives.length}`
    );
    return NextResponse.json(parsed.deepDives);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("generate-deep-dives", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
