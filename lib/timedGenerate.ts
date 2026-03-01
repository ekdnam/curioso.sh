import { performance } from "perf_hooks";
import { logger } from "@/lib/logger";
import { recordSample } from "@/lib/perfAccumulator";

export async function timedGenerate<T>(
  tag: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const durationMs = Math.round(performance.now() - start);
    recordSample(tag, durationMs);
    logger.perf(tag, "generateContent", durationMs);
  }
}
