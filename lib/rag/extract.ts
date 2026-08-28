import "server-only";
import { PDFParse } from "pdf-parse";

// Extract plain text from an uploaded file. Supports PDF and plain text/markdown.
export async function extractText(
  file: File
): Promise<{ text: string; contentType: string }> {
  const contentType = (file.type || "").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (contentType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return { text: result.text, contentType: "application/pdf" };
  }

  if (
    contentType.startsWith("text/") ||
    contentType === "application/json" ||
    /\.(txt|md|markdown|csv)$/i.test(file.name)
  ) {
    return { text: buffer.toString("utf-8"), contentType: contentType || "text/plain" };
  }

  throw new Error(
    `Unsupported file type: ${contentType || file.name}. Upload a PDF or a text file.`
  );
}
