import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chunkText } from "@/lib/rag/chunker";
import { embed } from "@/lib/rag/embeddings";
import { upsertChunks } from "@/lib/pinecone";
import { runRAG } from "@/lib/rag/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dev/QA helper — not part of the product surface. Lets us:
//   1. Seed sample/urdu-faq.txt into a business's Pinecone namespace (?seed=1)
//   2. Run a grounded RAG query: /api/test-rag?businessId=<uuid>&q=<question>
// Gated by RAG_TEST_SECRET header so it can't be used by strangers.

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 404 });
  }
  const secret = process.env.RAG_TEST_SECRET;
  if (!secret || req.headers.get("x-test-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = req.nextUrl.searchParams.get("businessId");
  const q = req.nextUrl.searchParams.get("q");
  const seed = req.nextUrl.searchParams.get("seed");

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  if (seed) {
    const file = path.join(process.cwd(), "sample", "urdu-faq.txt");
    const text = readFileSync(file, "utf-8");
    const chunks = chunkText(text);
    const vectors = await embed(
      chunks.map((c) => c.text),
      "passage"
    );
    await upsertChunks(
      businessId,
      chunks.map((c, i) => ({
        id: `sample-faq:${c.index}`,
        values: vectors[i],
        meta: {
          businessId,
          docId: "sample-faq",
          filename: "urdu-faq.txt",
          chunkIndex: c.index,
          text: c.text,
        },
      }))
    );
    return NextResponse.json({ seeded: true, chunks: chunks.length });
  }

  if (!q) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  const result = await runRAG({
    businessId,
    companyName: "Test Business",
    question: q,
  });

  return NextResponse.json({
    question: q,
    answer: result.answer,
    answerable: result.answerable,
    language: result.language,
    confidence: Number(result.confidence.toFixed(3)),
    lowConfidence: result.lowConfidence,
    topChunks: result.chunks.slice(0, 3).map((c) => ({
      score: Number(c.score.toFixed(4)),
      text: c.text.slice(0, 200),
    })),
  });
}
