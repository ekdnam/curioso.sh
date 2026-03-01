"use client";

import { useState } from "react";
import { Course, Level } from "@/types/course";
import { logger } from "@/lib/logger";
import { parseCourse } from "@/lib/parseCourse";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; course: Course }
  | { status: "error"; message: string };

export function useGenerateCourse() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function generate(topic: string, level: Level) {
    logger.info("useGenerateCourse", `Starting course generation — topic="${topic}", level="${level}"`);
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Request failed");
      }

      const { raw } = await res.json();
      const course = parseCourse(raw);
      logger.info("useGenerateCourse", "Course received successfully");
      setState({ status: "success", course });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      logger.error("useGenerateCourse", `Error during generation: ${message}`);
      setState({ status: "error", message });
    }
  }

  function reset() {
    setState({ status: "idle" });
  }

  return { state, generate, reset };
}
