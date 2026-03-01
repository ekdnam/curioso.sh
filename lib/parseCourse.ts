import { Course } from "@/types/course";

export function parseCourse(raw: string): Course {
  const data = JSON.parse(raw);

  if (!data.courseName || !data.courseCode || !data.description || !data.instructor) {
    throw new Error("Invalid course structure: missing top-level fields");
  }
  if (!Array.isArray(data.weeks) || data.weeks.length === 0) {
    throw new Error("Invalid course structure: weeks must be a non-empty array");
  }

  return data as Course;
}
