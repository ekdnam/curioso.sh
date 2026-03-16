import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { geminiModel } from "@/lib/config";
import { logger } from "@/lib/logger";
import { geminiRetry } from "@/lib/geminiRetry";
import { getCached, setCache } from "@/lib/cache";
import { SchemaType, type Schema } from "@google/generative-ai";

const GLOSSARY_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    terms: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          term: { type: SchemaType.STRING },
          definition: { type: SchemaType.STRING },
        },
        required: ["term", "definition"],
      },
    },
  },
  required: ["terms"],
};

export async function POST(req: NextRequest) {
  try {
    const { lectureNotes, weekNumber, topic, knownTerms } = (await req.json()) as {
      lectureNotes: string;
      weekNumber?: number;
      topic?: string;
      knownTerms?: string[];
    };

    logger.info("generate-glossary", `Request received — week=${weekNumber ?? "?"}, lectureNotes length=${lectureNotes?.length ?? 0}`);

    if (!lectureNotes) {
      return NextResponse.json(
        { error: "lectureNotes is required" },
        { status: 400 }
      );
    }

    if (topic) {
      const cached = getCached<{ terms: { term: string; definition: string }[] }>(
        "glossary", topic, `week-${weekNumber ?? 0}`
      );
      if (cached) {
        return NextResponse.json(cached.terms);
      }
    }

    const model = genAI.getGenerativeModel({
      model: geminiModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GLOSSARY_SCHEMA,
      },
    });

    const prompt = `Extract technical terms and jargon from the following lecture notes. For each term, provide a concise definition (1-2 sentences) that a student could understand.

Only include:
- Technical terms, concepts, and domain-specific jargon
- Terms like protocols, molecules, architectures, data structures, historical entities a layman would not know. This is important
- Acronyms and abbreviations with technical meaning

Do NOT include:
- Company names or product names (e.g., Google, AWS)
- Common English words or general nouns
- People's names
- Terms that any educated adult would know
${knownTerms?.length ? `- Any of these already-defined terms: ${knownTerms.join(", ")}` : ""}

Lecture notes:
${lectureNotes}`;

    logger.info("generate-glossary", `Gemini call starting — week=${weekNumber ?? "?"}`);

    const parsed = await geminiRetry("generate-glossary", async () => {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text);
    });

    if (topic) {
      setCache("glossary", topic, `week-${weekNumber ?? 0}`, parsed);
    }

    logger.info("generate-glossary", `week=${weekNumber ?? "?"} — ${parsed.terms.length} terms extracted`);
    return NextResponse.json(parsed.terms);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("generate-glossary", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
