import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "@/lib/logger";

const CACHE_DIR = join(process.cwd(), ".cache", "gemini");

function ensureCacheDir(subdir: string) {
  const dir = join(CACHE_DIR, subdir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
}

export function getCached<T>(namespace: string, topic: string, key: string): T | null {
  try {
    const dir = ensureCacheDir(safeFilename(topic));
    const file = join(dir, `${namespace}-${safeFilename(key)}.json`);
    if (!existsSync(file)) return null;
    const data = JSON.parse(readFileSync(file, "utf-8")) as T;
    logger.info("cache", `HIT ${namespace}/${key}`);
    return data;
  } catch {
    return null;
  }
}

export function setCache(namespace: string, topic: string, key: string, data: unknown): void {
  try {
    const dir = ensureCacheDir(safeFilename(topic));
    const file = join(dir, `${namespace}-${safeFilename(key)}.json`);
    writeFileSync(file, JSON.stringify(data));
    logger.info("cache", `WRITE ${namespace}/${key}`);
  } catch {
    // cache write failure is non-fatal
  }
}
