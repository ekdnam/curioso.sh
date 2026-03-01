import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

export function useDeepDiveContent(
  title: string | null,
  summary: string | null,
  lectureNotes: string | null,
  topic: string
) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!title || !summary || !lectureNotes) {
      setContent(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setContent(null);
    setLoading(true);

    (async () => {
      try {
        logger.info("useDeepDiveContent", `Fetching content for "${title}"`);
        const res = await fetch("/api/generate-deep-dive-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, summary, lectureNotes, topic }),
          signal: controller.signal,
        });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setContent(data.content);
        logger.info("useDeepDiveContent", `Content loaded for "${title}"`);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        logger.error("useDeepDiveContent", `Error fetching content for "${title}"`);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [title, summary, lectureNotes, topic]);

  return { content, loading };
}
