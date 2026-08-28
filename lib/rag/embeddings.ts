// Embedding providers.
//
// Default: Hugging Face Inference API with intfloat/multilingual-e5-large.
// Why: Claude has no embeddings API, and this model is free-tier, 1024-dim,
// and trained on 100+ languages — it handles Urdu script AND Roman Urdu,
// which English-centric embedders handle weakly. E5 models expect an
// instruction prefix ("query: " / "passage: ") for best retrieval quality.
//
// Fallback: OpenAI text-embedding-3-small (~$0.02/1M tokens) — set
// EMBEDDING_PROVIDER=openai and OPENAI_API_KEY.

export type EmbeddingKind = "query" | "passage";

const HF_MODEL = "intfloat/multilingual-e5-large";
const HF_BATCH = 8;
const OPENAI_MODEL = "text-embedding-3-small";
const OPENAI_BATCH = 64;

export function embeddingDimension(): number {
  return provider() === "openai" ? 1540 : 1024;
}

function provider(): "hf" | "openai" {
  return process.env.EMBEDDING_PROVIDER === "openai" ? "openai" : "hf";
}

function withPrefix(text: string, kind: EmbeddingKind): string {
  // E5 instruction prefixes; harmless for OpenAI.
  return provider() === "hf"
    ? kind === "query"
      ? `query: ${text}`
      : `passage: ${text}`
    : text;
}

export async function embed(
  texts: string[],
  kind: EmbeddingKind
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const prefixed = texts.map((t) => withPrefix(t, kind));

  if (provider() === "openai") {
    return embedOpenAI(prefixed);
  }
  return embedHF(prefixed);
}

export async function embedOne(text: string, kind: EmbeddingKind): Promise<number[]> {
  const [vec] = await embed([text], kind);
  if (!vec) throw new Error("Embedding provider returned no vector");
  return vec;
}

async function embedHF(inputs: string[]): Promise<number[][]> {
  const token = process.env.HF_API_TOKEN;
  if (!token) throw new Error("HF_API_TOKEN is not set");

  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += HF_BATCH) {
    const batch = inputs.slice(i, i + HF_BATCH);
    const res = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: batch,
          options: { wait_for_model: true },
        }),
      }
    );
    if (!res.ok) {
      throw new Error(
        `Hugging Face embeddings failed (${res.status}): ${(await res.text()).slice(0, 300)}`
      );
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      throw new Error("Unexpected Hugging Face embeddings response shape");
    }
    out.push(...(data as number[][]));
  }
  return out;
}

async function embedOpenAI(inputs: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += OPENAI_BATCH) {
    const batch = inputs.slice(i, i + OPENAI_BATCH);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: OPENAI_MODEL, input: batch }),
    });
    if (!res.ok) {
      throw new Error(
        `OpenAI embeddings failed (${res.status}): ${(await res.text()).slice(0, 300)}`
      );
    }
    const data = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
    };
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}
