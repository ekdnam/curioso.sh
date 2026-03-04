import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { logger } from "@/lib/logger";
import { timedGenerate } from "@/lib/timedGenerate";
import { getCached, setCache } from "@/lib/cache";
import { deepDiveMode } from "@/lib/config";
import { Level } from "@/types/course";
import { SchemaType, type Schema } from "@google/generative-ai";

const SYSTEM_INSTRUCTION =
  "You are an expert curriculum designer who creates rigorous university-level course syllabi modeled after premier universities like Stanford and UCSD.";

const deepDiveItemProperties: Record<string, Schema> = {
  title: { type: SchemaType.STRING },
  summary: { type: SchemaType.STRING },
  ...(deepDiveMode === "full" ? { content: { type: SchemaType.STRING } } : {}),
};

const deepDiveItemRequired =
  deepDiveMode === "full" ? ["title", "summary", "content"] : ["title", "summary"];

const WEEK_ITEMS_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    weekNumber: { type: SchemaType.INTEGER },
    title: { type: SchemaType.STRING },
    overview: { type: SchemaType.STRING },
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
    ...(deepDiveMode !== "separate"
      ? {
          deepDives: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: deepDiveItemProperties,
              required: deepDiveItemRequired,
            },
          },
        }
      : {}),
  },
  required: [
    "weekNumber",
    "title",
    "overview",
    "lectureNotes",
    "requiredReading",
    ...(deepDiveMode !== "separate" ? ["deepDives"] : []),
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

const DEEP_DIVE_GUIDELINES =
  deepDiveMode === "full"
    ? `\nFor deepDives: generate 3 deep dive topics per week. Each should have a title, a 1-2 sentence summary, and detailed multi-paragraph content exploring the topic in depth with examples.`
    : deepDiveMode === "bundled"
      ? `\nFor deepDives: generate 3 deep dive topics per week. Each should have a concise title and a 1-2 sentence summary describing what the deep dive covers.`
      : "";

const CONTENT_GUIDELINES = `For lectureNotes: write detailed, multi-paragraph instructional content that teaches the week's topic. Include key concepts, explanations, and concrete examples. This should be substantive learning material — what a student would read to actually learn the content, not just a summary.
For requiredReading: cite only real, verifiable works (books, papers, articles).${DEEP_DIVE_GUIDELINES}`;

export async function POST(req: NextRequest) {
  try {
    const { topic, level, weekStart, weekEnd, courseOutline, allWeeks, nextTopicContext } = (await req.json()) as {
      topic: string;
      level: Level;
      weekStart?: number;
      weekEnd?: number;
      courseOutline?: string;
      allWeeks?: boolean;
      nextTopicContext?: string;
    };

    const isChunked = weekStart !== undefined && weekEnd !== undefined && !allWeeks;

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
      const isSingleWeek = weekStart === weekEnd;

      // Check per-week cache for single-week requests
      if (isSingleWeek) {
        const cached = getCached<{ weeks: unknown[] }>(
          "week-content", topic, `week-${weekStart}`
        );
        if (cached) {
          logger.info("generate-course", `Cache hit for week ${weekStart}`);
          return NextResponse.json({ raw: JSON.stringify(cached), chunk: true });
        }
      }

      // Generate only the requested weeks
      const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: WEEKS_ONLY_SCHEMA,
          maxOutputTokens: isSingleWeek ? 8192 : 12000,
        },
      });

      const weekRange = isSingleWeek
        ? `ONLY week ${weekStart}`
        : `ONLY weeks ${weekStart} through ${weekEnd}`;

      const topicDirection = nextTopicContext
        ? `\nSpecific direction for this week:\n${nextTopicContext}\n`
        : "";

      const prompt = `You are continuing to build a university-style course on: "${topic}"
Difficulty level: ${level}

${LEVEL_CALIBRATION}

Here is the course outline so far (week titles) for context:
${courseOutline ?? "Not available"}
${topicDirection}
Now generate ${weekRange}. Make sure weekNumber matches correctly.

${CONTENT_GUIDELINES}`;

      logger.info("generate-course", `Gemini call starting for weeks ${weekStart}-${weekEnd}`);
      const result = await timedGenerate(
        isSingleWeek ? `generate-course:week-${weekStart}` : "generate-course:chunk",
        () => model.generateContent(prompt)
      );
      const text = result.response.text();

      // Cache single-week results
      if (isSingleWeek) {
        try {
          const parsed = JSON.parse(text);
          setCache("week-content", topic, `week-${weekStart}`, parsed);
        } catch {
          // cache write failure is non-fatal
        }
      }

      logger.info("generate-course", `Weeks ${weekStart}-${weekEnd} received`);
      return NextResponse.json({ raw: text, chunk: true });
    }

    if (allWeeks) {
      // Single-shot: generate course metadata + all 10 weeks
      const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: COURSE_SCHEMA,
          maxOutputTokens: 65536,
        },
      });

      const prompt = `Design a 10-week university-style course on: "${topic}"
Difficulty level: ${level}

${LEVEL_CALIBRATION}

Generate the course metadata (courseName, description) and ALL 10 weeks. Include exactly 10 weeks in the weeks array, numbered 1 through 10.

${CONTENT_GUIDELINES}`;

      logger.info("generate-course", "Gemini call starting (single-shot: all weeks)");
      const result = await timedGenerate("generate-course:all-weeks", () =>
        model.generateContent(prompt)
      );
      const text = result.response.text();

      logger.info("generate-course", "Single-shot response received");
      return NextResponse.json({ raw: text, chunk: false });
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

${CONTENT_GUIDELINES}`;

    logger.info("generate-course", "Gemini call starting (initial chunk: weeks 1-2)");
    const result = await timedGenerate("generate-course:initial", () =>
      model.generateContent(prompt)
    );
    const text = result.response.text();

    logger.info("generate-course", "Initial chunk received");
    return NextResponse.json({ raw: text, chunk: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("generate-course", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
