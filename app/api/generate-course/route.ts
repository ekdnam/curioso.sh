import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { Level } from "@/types/course";
import { SchemaType, type Schema } from "@google/generative-ai";

const SYSTEM_INSTRUCTION =
  "You are an expert curriculum designer who creates rigorous university-level course syllabi modeled after Stanford and UCSD courses.";

const COURSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    courseName: { type: SchemaType.STRING },
    courseCode: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    instructor: { type: SchemaType.STRING },
    weeks: {
      type: SchemaType.ARRAY,
      items: {
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
          "requiredReading",
        ],
      },
    },
  },
  required: ["courseName", "courseCode", "description", "instructor", "weeks"],
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

Level calibration:
- Beginner: Assume no prior domain knowledge, start from fundamentals
- Intermediate: Assume 1-2 years experience, skip basics, go deep
- Advanced: Assume expert practitioners, focus on research frontiers and tradeoffs

For requiredReading: cite only real, verifiable works (books, papers, articles).
For prerequisites of week 1: list background knowledge.
For prerequisites of weeks 2-10: reference specific prior weeks by name.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ raw: text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-course]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
