import "server-only";
import { Pinecone, type Index, type RecordMetadata } from "@pinecone-database/pinecone";
import { embeddingDimension } from "@/lib/rag/embeddings";

// Server-only. One Pinecone index; strict per-business isolation via
// namespaces (namespace = business id), so one business can never query
// another's vectors.
//
// Written against @pinecone-database/pinecone v8, which targets an index via
// pc.index({ name }) and passes `namespace` inside each operation's options.

const UPSERT_BATCH = 100;

type ChunkMeta = {
  docId: string;
  filename: string;
  chunkIndex: number;
  text: string;
};

function client(): Pinecone {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error("PINECONE_API_KEY is not set");
  return new Pinecone({ apiKey });
}

function indexName(): string {
  return process.env.PINECONE_INDEX ?? "guftagu";
}

export async function ensureIndex(): Promise<Index<ChunkMeta>> {
  const pc = client();
  const name = indexName();

  // suppressConflicts: no-op if it already exists. waitUntilReady: block until
  // the index can accept data operations (new serverless indexes need a moment).
  await pc.createIndex({
    name,
    dimension: embeddingDimension(),
    metric: "cosine",
    spec: {
      serverless: {
        cloud: (process.env.PINECONE_CLOUD as "aws" | "gcp" | "azure") ?? "aws",
        region: process.env.PINECONE_REGION ?? "us-east-1",
      },
    },
    suppressConflicts: true,
    waitUntilReady: true,
  });

  return pc.index<ChunkMeta>({ name });
}

export async function getIndex(): Promise<Index<ChunkMeta>> {
  return client().index<ChunkMeta>({ name: indexName() });
}

export async function upsertChunks(
  businessId: string,
  vectors: { id: string; values: number[]; meta: ChunkMeta }[]
): Promise<void> {
  const index = await ensureIndex();

  for (let i = 0; i < vectors.length; i += UPSERT_BATCH) {
    const records = vectors.slice(i, i + UPSERT_BATCH).map((v) => ({
      id: v.id,
      values: v.values,
      metadata: v.meta,
    }));
    await index.upsert({ records, namespace: businessId });
  }
}

export interface RetrievedChunk {
  text: string;
  score: number;
  filename: string;
  docId: string;
  chunkIndex: number;
}

export async function queryChunks(
  businessId: string,
  queryVector: number[],
  topK: number
): Promise<RetrievedChunk[]> {
  const index = await getIndex();
  const res = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    namespace: businessId,
  });

  return res.matches.map((m) => {
    const md = (m.metadata ?? {}) as Partial<ChunkMeta> & RecordMetadata;
    return {
      text: typeof md.text === "string" ? md.text : "",
      score: m.score ?? 0,
      filename: typeof md.filename === "string" ? md.filename : "",
      docId: typeof md.docId === "string" ? md.docId : "",
      chunkIndex: typeof md.chunkIndex === "number" ? md.chunkIndex : 0,
    };
  });
}

export async function deleteDocumentVectors(
  businessId: string,
  docId: string
): Promise<void> {
  const index = await getIndex();
  await index.deleteMany({
    filter: { docId: { $eq: docId } },
    namespace: businessId,
  });
}
