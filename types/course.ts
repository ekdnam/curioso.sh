export type Level = "Beginner" | "Intermediate" | "Advanced";

export interface Reading {
  title: string;
  author: string;
  year: number;
  notes: string;
}

export interface Week {
  weekNumber: number;
  title: string;
  overview: string;
  lectureNotes: string;
  requiredReading: Reading[];
  deepDives?: DeepDiveSummary[];
  glossary?: GlossaryEntry[];
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

export interface WeekSkeleton {
  weekNumber: number;
  title: string;
  description: string;
}

export interface CourseSkeleton {
  courseName: string;
  description: string;
  weeks: WeekSkeleton[];
}

export interface RoadmapTopic {
  weekNumber: number;
  title: string;
  overview: string;
}
