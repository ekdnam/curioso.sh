export type Level = "Beginner" | "Intermediate" | "Advanced";

export interface Reading {
  type: "book" | "paper" | "article" | "chapter";
  title: string;
  author: string;
  year: number;
  notes: string;
}

export interface Week {
  weekNumber: number;
  title: string;
  overview: string;
  prerequisites: string[];
  learningObjectives: string[];
  lectureNotes: string;
  requiredReading: Reading[];
  deepDives?: DeepDiveSummary[];
}

export interface DeepDiveSummary {
  title: string;
  summary: string;
}

export interface DeepDive extends DeepDiveSummary {
  content: string;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface Course {
  courseName: string;
  description: string;
  topic: string;
  level: Level;
  weeks: Week[];
}
