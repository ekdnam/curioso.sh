import { GoogleGenerativeAIFetchError, GoogleGenerativeAIResponseError } from "@google/generative-ai";
import { logger } from "@/lib/logger";
import { timedGenerate } from "@/lib/timedGenerate";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function describeError(err: unknown): string {
  if (err instanceof GoogleGenerativeAIFetchError) {
    const parts = [`HTTP ${err.status ?? "?"} ${err.statusText ?? ""}`];
    parts.push(err.message);
    if (err.errorDetails?.length) {
      for (const d of err.errorDetails) {
        parts.push(`  reason=${d.reason ?? "?"} domain=${d.domain ?? "?"} ${d.metadata ? JSON.stringify(d.metadata) : ""}`);
      }
    }
    return parts.join("\n");
  }
  if (err instanceof GoogleGenerativeAIResponseError) {
    return `ResponseError: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Unknown error";
}

export async function geminiRetry<T>(
  tag: string,
  fn: () => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await timedGenerate(tag, fn);
    } catch (err) {
      const detail = describeError(err);
      if (attempt === MAX_RETRIES) {
        logger.error(tag, `All ${MAX_RETRIES + 1} attempts failed. Last error:\n${detail}`);
        throw err;
      }
      const delay = BASE_DELAY_MS * 2 ** attempt;
      logger.error(tag, `Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed — retrying in ${delay}ms:\n${detail}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}
