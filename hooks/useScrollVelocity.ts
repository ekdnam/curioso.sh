"use client";

import { useRef, useCallback } from "react";
import { prefetchCount, maxPrefetchCount } from "@/lib/config";

/**
 * Tracks week-view timestamps and computes a dynamic prefetch count
 * based on how fast the user is scrolling through weeks.
 */
export function useScrollVelocity() {
  const lastViewTime = useRef(Date.now());
  const lastWeek = useRef(0);
  const velocityRef = useRef(0); // weeks per second

  const recordView = useCallback((weekIndex: number) => {
    const now = Date.now();
    const elapsed = (now - lastViewTime.current) / 1000;
    if (elapsed > 0.1 && weekIndex !== lastWeek.current) {
      const weeksDelta = Math.abs(weekIndex - lastWeek.current);
      velocityRef.current = weeksDelta / elapsed;
    }
    lastViewTime.current = now;
    lastWeek.current = weekIndex;
  }, []);

  const getDynamicPrefetchCount = useCallback(() => {
    // dynamicPrefetchCount = clamp(weeksPerSec * 8 + 2, prefetchCount, maxPrefetchCount)
    const raw = velocityRef.current * 8 + 2;
    return Math.round(Math.min(Math.max(raw, prefetchCount), maxPrefetchCount));
  }, []);

  const reset = useCallback(() => {
    lastViewTime.current = Date.now();
    lastWeek.current = 0;
    velocityRef.current = 0;
  }, []);

  return { recordView, getDynamicPrefetchCount, reset };
}
