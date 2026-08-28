import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { RetrievedChunk } from "@/lib/pinecone";

// Grounded answer generation with Anthropic Claude.
//
// We force a tool call ("provide_answer") instead of parsing free text so the
// structured signal (answerable / language / answer) is guaranteed by the API.
// This is what powers the "never hallucinate, escalate instead" guarantee:
// Claude can only answer from the supplied context, and it explicitly reports
// when the context is insufficient.

const DEFAULT_MODEL = "claude-3-5-haiku-latest";

export type DetectedLanguage = "ur" | "roman-ur" | "en" | "other";

export interface GroundedResult {
  answer: string;
  answerable: boolean;
  language: DetectedLanguage;
}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

function model(): string {
  return process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
}

function buildContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "(no context available)";
  return chunks
    .map((c, i) => `[${i + 1}] (relevance ${c.score.toFixed(3)})\n${c.text}`)
    .join("\n\n---\n\n");
}

export async function generateGroundedAnswer(opts: {
  companyName: string;
  question: string;
  chunks: RetrievedChunk[];
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<GroundedResult> {
  const { companyName, question, chunks, history = [] } = opts;

  const system = `You are "Guftagu" (گفتگو), the customer-support assistant for "${companyName}".

STRICT GROUNDING RULES:
1. Answer ONLY using information present in the CONTEXT below. Treat the CONTEXT as the sole source of truth.
2. NEVER use outside knowledge. NEVER invent prices, dates, phone numbers, policies, or any fact not in the CONTEXT.
3. If the CONTEXT does not contain enough information to answer, set "answerable" to false. Do not guess.
4. Reply in the SAME language AND script the customer used in their latest message:
   - If they wrote Urdu in Urdu script, reply in Urdu script.
   - If they wrote Roman Urdu (Urdu words in Latin letters), reply in Roman Urdu.
   - If they wrote English, reply in English.
5. Be warm, concise and helpful. Keep answers short (a few sentences) unless the context requires more.

CONTEXT:
${buildContext(chunks)}`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  const resp = await client().messages.create({
    model: model(),
    max_tokens: 1024,
    system,
    messages,
    tools: [
      {
        name: "provide_answer",
        description:
          "Return the grounded customer-support answer. Set answerable=false if the context does not contain the answer.",
        input_schema: {
          type: "object" as const,
          properties: {
            answerable: {
              type: "boolean",
              description:
                "true only if the CONTEXT contains enough information to answer the customer's question.",
            },
            language: {
              type: "string",
              enum: ["ur", "roman-ur", "en", "other"],
              description: "The language/script of the customer's message.",
            },
            answer: {
              type: "string",
              description:
                "The reply to show the customer, in their language/script. If not answerable, a short polite note that a human will follow up.",
            },
          },
          required: ["answerable", "language", "answer"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "provide_answer" },
  });

  const toolBlock = resp.content.find((b) => b.type === "tool_use");
  if (toolBlock && toolBlock.type === "tool_use") {
    const input = toolBlock.input as {
      answerable?: boolean;
      language?: string;
      answer?: string;
    };
    return {
      answer: String(input.answer ?? "").trim(),
      answerable: Boolean(input.answerable),
      language: normalizeLanguage(input.language),
    };
  }

  // Fallback: model didn't use the tool — treat raw text as an answer.
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { answer: text, answerable: text.length > 0, language: "other" };
}

function normalizeLanguage(lang?: string): DetectedLanguage {
  if (lang === "ur" || lang === "roman-ur" || lang === "en" || lang === "other") {
    return lang;
  }
  return "other";
}
