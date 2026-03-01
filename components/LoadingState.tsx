"use client";

import { useState, useEffect } from "react";

export function LoadingState() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-6 bg-white">
      <div className="text-center space-y-1">
        <p className="text-blue-600 text-sm font-medium">Building your course&hellip;</p>
        <h2 className="text-xl font-bold text-gray-900">Generating curriculum</h2>
        <p className="text-gray-500 text-sm">This usually takes 10–20 seconds · {elapsed}s elapsed</p>
      </div>

      <div className="w-full max-w-lg space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="h-3 w-16 rounded bg-gray-200" />
            <div className="h-5 w-2/3 rounded bg-gray-200" />
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-4/5 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
