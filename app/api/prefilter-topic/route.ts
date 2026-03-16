import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { geminiModel } from "@/lib/config";
import { logger } from "@/lib/logger";
import { timedGenerate } from "@/lib/timedGenerate";
import { SchemaType, type Schema } from "@google/generative-ai";

const PREFILTER_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    sensible: { type: SchemaType.BOOLEAN },
    refinedTopic: { type: SchemaType.STRING },
    wasRefined: { type: SchemaType.BOOLEAN },
  },
  required: ["sensible", "refinedTopic", "wasRefined"],
};

export async function POST(req: NextRequest) {
  try {
    const { topic } = (await req.json()) as { topic: string };

    logger.info("prefilter-topic", `Request received — topic="${topic}"`);

    if (!topic) {
      return NextResponse.json(
        { error: "topic is required" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: geminiModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: PREFILTER_SCHEMA,
      },
    });

    const prompt = `A user wants to generate a university-level course. Their input is: "${topic}"

Your job is to refine this into a proper course-worthy topic name.

Fields:
- "sensible": false only if the input is complete gibberish, random characters, or has zero discernible meaning. Anything with real intent (even informal, niche, or narrow) is sensible.
- "refinedTopic": a well-formed course topic suitable for a university syllabus. Always return this, even if the input is already good.
- "wasRefined": true if you changed the topic meaningfully (not just capitalization fixes). false if the input was already a clear course topic and you kept it as-is or only fixed casing/typos.

Refinement rules:
- If the input is already a clear academic/professional subject, keep it (just clean up casing/typos). wasRefined = false.
- If the input is a narrow or specific thing (a dish, a tool, a technique), broaden it to the encompassing field while keeping the user's interest as a focus. wasRefined = true.
- If the input is gibberish with no signal, pick a broadly popular topic. wasRefined = true.

Examples:
- "machine learning" → { sensible: true, refinedTopic: "Machine Learning", wasRefined: false }
- "compter scince" → { sensible: true, refinedTopic: "Computer Science", wasRefined: false }
- "aloo paratha" → { sensible: true, refinedTopic: "North Indian Cuisine & Cooking Techniques", wasRefined: true }
- "cook pasta" → { sensible: true, refinedTopic: "Italian Cooking & Pasta Making", wasRefined: true }
- "react hooks" → { sensible: true, refinedTopic: "React.js & Modern Frontend Development", wasRefined: true }
- "bitcoin" → { sensible: true, refinedTopic: "Cryptocurrency & Blockchain Technology", wasRefined: true }
- "asjkdfhlk" → { sensible: false, refinedTopic: "Computer Science", wasRefined: true }
- "uhhhh idk lol" → { sensible: false, refinedTopic: "Introduction to Psychology", wasRefined: true }
- "organic chemistry" → { sensible: true, refinedTopic: "Organic Chemistry", wasRefined: false }`;

    const result = await timedGenerate("prefilter-topic", () =>
      model.generateContent(prompt)
    );
    const parsed = JSON.parse(result.response.text());

    logger.info(
      "prefilter-topic",
      `Result — sensible=${parsed.sensible}, refinedTopic="${parsed.refinedTopic}", wasRefined=${parsed.wasRefined}`
    );

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("prefilter-topic", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
