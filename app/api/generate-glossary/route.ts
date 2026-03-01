import { NextRequest, NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { logger } from "@/lib/logger";
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
    const { lectureNotes } = (await req.json()) as { lectureNotes: string };

    logger.info("generate-glossary", `Request received — lectureNotes length=${lectureNotes?.length ?? 0}`);

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
        responseSchema: GLOSSARY_SCHEMA,
      },
    });

    const prompt = `Extract technical terms and jargon from the following lecture notes. For each term, provide a concise definition (1-2 sentences) that a student could understand.

Only include:
- Technical terms, concepts, and domain-specific jargon
- Named architectures, algorithms, protocols, and data structures
- Acronyms and abbreviations with technical meaning

Do NOT include:
- Company names or product names (e.g., Google, AWS)
- Common English words or general nouns
- People's names
- Terms that any educated adult would know

Lecture notes:
${lectureNotes}`;

    logger.info("generate-glossary", "Gemini call starting");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    logger.info("generate-glossary", `Terms extracted: ${parsed.terms.length}`);
    return NextResponse.json(parsed.terms);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("generate-glossary", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
