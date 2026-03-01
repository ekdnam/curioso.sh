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
  requiredReading: Reading[];
}

export interface Course {
  courseName: string;
  courseCode: string;
  description: string;
  instructor: string;
  weeks: Week[];
}
