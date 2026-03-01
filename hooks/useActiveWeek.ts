"use client";

import { useEffect, useRef, useState } from "react";

export function useActiveWeek(count: number) {
  const [activeIndex, setActiveIndex] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    refs.current.forEach((el, i) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveIndex(i);
        },
        { threshold: 0.6 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [count]);

  function setRef(i: number) {
    return (el: HTMLDivElement | null) => {
      refs.current[i] = el;
    };
  }

  return { activeIndex, setRef };
}
