import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { logger } from "@/lib/logger";
import { Level } from "@/types/course";
import { SchemaType, type Schema } from "@google/generative-ai";

const SYSTEM_INSTRUCTION =
  "You are an expert curriculum designer who creates rigorous university-level course syllabi modeled after premier universities like Stanford and UCSD.";

const WEEK_ITEMS_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    weekNumber: { type: SchemaType.INTEGER },
    title: { type: SchemaType.STRING },
    overview: { type: SchemaType.STRING },
    prerequisites: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    learningObjectives: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    lectureNotes: { type: SchemaType.STRING },
    requiredReading: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          author: { type: SchemaType.STRING },
          year: { type: SchemaType.INTEGER },
          notes: { type: SchemaType.STRING },
        },
        required: ["type", "title", "author", "year", "notes"],
      },
    },
  },
  required: [
    "weekNumber",
    "title",
    "overview",
    "prerequisites",
    "learningObjectives",
    "lectureNotes",
    "requiredReading",
  ],
};

const COURSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    courseName: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    weeks: {
      type: SchemaType.ARRAY,
      items: WEEK_ITEMS_SCHEMA,
    },
  },
  required: ["courseName", "description", "weeks"],
};

const WEEKS_ONLY_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    weeks: {
      type: SchemaType.ARRAY,
      items: WEEK_ITEMS_SCHEMA,
    },
  },
  required: ["weeks"],
};

const LEVEL_CALIBRATION = `Level calibration:
- Beginner: Assume no prior domain knowledge, start from fundamentals
- Intermediate: Assume 1-2 years experience, skip basics, go deep
- Advanced: Assume expert practitioners, focus on research frontiers and tradeoffs`;

const CONTENT_GUIDELINES = `For lectureNotes: write detailed, multi-paragraph instructional content that teaches the week's topic. Include key concepts, explanations, and concrete examples. This should be substantive learning material — what a student would read to actually learn the content, not just a summary.
For requiredReading: cite only real, verifiable works (books, papers, articles).`;

export async function POST(req: NextRequest) {
  try {
    const { topic, level, weekStart, weekEnd, courseOutline } = (await req.json()) as {
      topic: string;
      level: Level;
      weekStart?: number;
      weekEnd?: number;
      courseOutline?: string;
    };

    const isChunked = weekStart !== undefined && weekEnd !== undefined;

    logger.info(
      "generate-course",
      isChunked
        ? `Chunk request — topic="${topic}", weeks ${weekStart}-${weekEnd}`
        : `Initial request — topic="${topic}", level="${level}"`
    );

    if (!topic || !level) {
      return NextResponse.json(
        { error: "topic and level are required" },
        { status: 400 }
      );
    }

    if (isChunked) {
      // Generate only the requested weeks
      const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: WEEKS_ONLY_SCHEMA,
          maxOutputTokens: 12000,
        },
      });

      const prompt = `You are continuing to build a 10-week university-style course on: "${topic}"
Difficulty level: ${level}

${LEVEL_CALIBRATION}

Here is the course outline so far (week titles) for context:
${courseOutline ?? "Not available"}

Now generate ONLY weeks ${weekStart} through ${weekEnd}. Make sure weekNumber matches correctly.

${CONTENT_GUIDELINES}
For prerequisites: reference specific prior weeks by name.`;

      logger.info("generate-course", `Gemini call starting for weeks ${weekStart}-${weekEnd}`);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      logger.info("generate-course", `Weeks ${weekStart}-${weekEnd} received`);
      return NextResponse.json({ raw: text, chunk: true });
    }

    // Initial call: generate course metadata + first 2 weeks
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: COURSE_SCHEMA,
        maxOutputTokens: 8192,
      },
    });

    const prompt = `Design a 10-week university-style course on: "${topic}"
Difficulty level: ${level}

${LEVEL_CALIBRATION}

IMPORTANT: Generate the course metadata (courseName, description) and ONLY weeks 1 and 2. Include a total of exactly 2 weeks in the weeks array.

${CONTENT_GUIDELINES}
For prerequisites of week 1: list background knowledge.
For prerequisites of week 2: reference week 1 by name.`;

    logger.info("generate-course", "Gemini call starting (initial chunk: weeks 1-2)");
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    logger.info("generate-course", "Initial chunk received");
    return NextResponse.json({ raw: text, chunk: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("generate-course", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
