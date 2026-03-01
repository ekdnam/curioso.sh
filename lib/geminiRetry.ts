import { logger } from "@/lib/logger";
import { timedGenerate } from "@/lib/timedGenerate";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export async function geminiRetry<T>(
  tag: string,
  fn: () => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await timedGenerate(tag, fn);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const delay = BASE_DELAY_MS * 2 ** attempt;
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.info(tag, `Attempt ${attempt + 1} failed (${message}), retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}
