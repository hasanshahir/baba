import "server-only";
import { queryChunks, type RetrievedChunk } from "@/lib/pinecone";
import { embedOne } from "@/lib/rag/embeddings";
import {
  generateGroundedAnswer,
  type DetectedLanguage,
} from "@/lib/rag/generate";

// The RAG pipeline: embed the query → retrieve the business's top-k chunks →
// generate a grounded answer → compute a confidence score that drives
// escalation. All numbers below are explained in the hackathon write-up.

export const RETRIEVE_TOP_K = 5;
// Cosine similarity of normalized e5 vectors. Empirically, a genuinely relevant
// FAQ chunk scores ~0.4–0.7, while unrelated text sits ~0.1–0.25. Below this
// floor we treat the best match as noise.
export const RELEVANCE_FLOOR = 0.25;
// Above this we consider retrieval strong (used only to normalize confidence).
const RELEVANCE_CEIL = 0.75;

export interface RAGResult {
  answer: string;
  answerable: boolean;
  language: DetectedLanguage;
  confidence: number; // 0..1, for display + ranking
  lowConfidence: boolean; // true → escalate to the business
  chunks: RetrievedChunk[];
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function retrievalScoreNorm(topScore: number): number {
  return clamp01((topScore - RELEVANCE_FLOOR) / (RELEVANCE_CEIL - RELEVANCE_FLOOR));
}

export async function runRAG(opts: {
  businessId: string;
  companyName: string;
  question: string;
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<RAGResult> {
  const { businessId, companyName, question, history } = opts;

  const queryVector = await embedOne(question, "query");
  const chunks = await queryChunks(businessId, queryVector, RETRIEVE_TOP_K);
  const topScore = chunks.length > 0 ? chunks[0].score : 0;

  const grounded = await generateGroundedAnswer({
    companyName,
    question,
    chunks,
    history,
  });

  const norm = retrievalScoreNorm(topScore);
  // If the model couldn't answer from context, confidence stays low regardless
  // of retrieval; otherwise blend retrieval strength with the grounded answer.
  const confidence = grounded.answerable
    ? clamp01(0.5 + 0.5 * norm)
    : clamp01(0.15 * norm);

  const lowConfidence = !grounded.answerable || topScore < RELEVANCE_FLOOR;

  return {
    answer: grounded.answer,
    answerable: grounded.answerable,
    language: grounded.language,
    confidence,
    lowConfidence,
    chunks,
  };
}
