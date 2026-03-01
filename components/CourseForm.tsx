"use client";

import { useState } from "react";
import { Level } from "@/types/course";

interface Props {
  onSubmit: (topic: string, level: Level) => void;
}

const LEVELS: Level[] = ["Beginner", "Intermediate", "Advanced"];

export function CourseForm({ onSubmit }: Props) {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<Level>("Beginner");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    onSubmit(topic.trim(), level);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-16 bg-white">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-blue-600 text-sm font-medium">Kalpana</p>
          <h1 className="text-3xl font-bold text-gray-900">
            What do you want to learn?
          </h1>
          <p className="text-gray-500 text-base">
            Enter any topic and get a structured 10-week course with readings,
            objectives, and week-by-week guidance.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="topic" className="block text-sm font-medium text-gray-700">
              Topic
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Distributed Systems, Music Theory, Machine Learning"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900
                         placeholder-gray-400 text-sm focus:outline-none focus:ring-2
                         focus:ring-blue-500 focus:border-transparent transition"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Difficulty level
            </label>
            <div className="flex gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition
                    ${
                      level === l
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                    }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!topic.trim()}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold text-sm
                       hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                       transition"
          >
            Generate Course
          </button>
        </form>

        <p className="text-center text-gray-400 text-xs">
          Curriculum modeled after Stanford &amp; UCSD syllabi · Powered by Gemini
        </p>
      </div>
    </div>
  );
}
