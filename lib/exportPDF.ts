import jsPDF from "jspdf";
import { Course } from "@/types/course";

export function exportCoursePDF(course: Course): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  function checkPage(needed: number) {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // --- Page 1: Title page ---
  y = pageHeight / 3;
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(course.courseName, maxWidth);
  doc.text(titleLines, pageWidth / 2, y, { align: "center" });
  y += titleLines.length * 30 + 20;

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Topic: ${course.topic}`, pageWidth / 2, y, { align: "center" });
  y += 22;
  doc.text(`Level: ${course.level}`, pageWidth / 2, y, { align: "center" });
  doc.setTextColor(0);

  // --- Week pages ---
  for (const week of course.weeks) {
    doc.addPage();
    y = margin;

    // Week heading
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    const heading = `Week ${week.weekNumber}: ${week.title}`;
    const headingLines = doc.splitTextToSize(heading, maxWidth);
    doc.text(headingLines, margin, y);
    y += headingLines.length * 22 + 16;

    // Lecture notes
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const noteLines: string[] = doc.splitTextToSize(
      week.lectureNotes,
      maxWidth
    );
    const lineHeight = 15;

    for (const line of noteLines) {
      checkPage(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
  }

  const safeName = course.courseName.replace(/[^a-zA-Z0-9]+/g, "_");
  doc.save(`${safeName}.pdf`);
}
