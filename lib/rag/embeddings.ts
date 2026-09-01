// Embedding providers.
//
// Default: Pinecone hosted inference with intfloat/multilingual-e5-large —
// the same model we originally chose, served by the vendor we already use for
// vectors (one fewer account, reliable endpoint). It is multilingual-first and
// handles Urdu script AND Roman Urdu, which English-centric embedders handle
// weakly. input_type ("query"/"passage") applies the e5 instruction prefixes
// server-side.
//
// Alternatives: EMBEDDING_PROVIDER=hf (Hugging Face Inference API, free tier)
// or EMBEDDING_PROVIDER=openai (text-embedding-3-small, ~$0.02/1M tokens).

export type EmbeddingKind = "query" | "passage";

const E5_MODEL = "multilingual-e5-large";
const PINECONE_API_VERSION = "2026-04";
const PINECONE_BATCH = 64;
const HF_BATCH = 8;
const OPENAI_MODEL = "text-embedding-3-small";
const OPENAI_BATCH = 64;

type Provider = "pinecone" | "hf" | "openai";

export function embeddingDimension(): number {
  return provider() === "openai" ? 1540 : 1024;
}

function provider(): Provider {
  const p = process.env.EMBEDDING_PROVIDER;
  if (p === "hf" || p === "openai") return p;
  return "pinecone";
}

function withPrefix(text: string, kind: EmbeddingKind): string {
  // Hugging Face e5 endpoints expect manual instruction prefixes; Pinecone
  // applies them via input_type, OpenAI needs none.
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

  const p = provider();
  if (p === "openai") return embedOpenAI(prefixed);
  if (p === "hf") return embedHF(prefixed);
  return embedPinecone(prefixed, kind);
}

export async function embedOne(text: string, kind: EmbeddingKind): Promise<number[]> {
  const [vec] = await embed([text], kind);
  if (!vec) throw new Error("Embedding provider returned no vector");
  return vec;
}

async function embedPinecone(
  inputs: string[],
  kind: EmbeddingKind
): Promise<number[][]> {
  const key = process.env.PINECONE_API_KEY;
  if (!key) throw new Error("PINECONE_API_KEY is not set");

  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += PINECONE_BATCH) {
    const batch = inputs.slice(i, i + PINECONE_BATCH);
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
      let res: Response;
      try {
        res = await fetch("https://api.pinecone.io/embed", {
          method: "POST",
          // Hard cap: a hung upstream once wedged the whole server. Normal
          // calls finish in ~1-3s; Vercel's function timeout is much higher.
          signal: AbortSignal.timeout(30_000),
          headers: {
            "Api-Key": key,
            "X-Pinecone-Api-Version": PINECONE_API_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: E5_MODEL,
            parameters: { input_type: kind === "query" ? "query" : "passage" },
            inputs: batch.map((text) => ({ text })),
          }),
        });
      } catch (err) {
        // Network error / timeout — retryable.
        lastError =
          err instanceof Error ? err : new Error("Pinecone embed request failed");
        continue;
      }
      if (!res.ok && res.status >= 500 && attempt < 2) {
        lastError = new Error(
          `Pinecone embeddings failed (${res.status}): ${(await res.text()).slice(0, 200)}`
        );
        continue;
      }
      if (!res.ok) {
        throw new Error(
          `Pinecone embeddings failed (${res.status}): ${(await res.text()).slice(0, 300)}`
        );
      }
      const data = (await res.json()) as {
        data: { values?: number[] }[];
      };
      out.push(...data.data.map((d) => d.values ?? []));
      lastError = null;
      break;
    }
    if (lastError) throw lastError;
  }
  return out;
}

async function embedHF(inputs: string[]): Promise<number[][]> {
  const token = process.env.HF_API_TOKEN;
  if (!token) throw new Error("HF_API_TOKEN is not set");

  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += HF_BATCH) {
    const batch = inputs.slice(i, i + HF_BATCH);
    const res = await fetch(
      `https://api-inference.huggingface.co/models/${E5_MODEL}`,
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
