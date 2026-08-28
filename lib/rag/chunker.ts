// Sentence-aware chunking tuned for short FAQ/policy docs in Urdu, Roman Urdu
// and English.
//
// Why ~800 chars with ~15% overlap:
//  - multilingual-e5 embeddings are most informative on dense, single-topic
//    segments; FAQ entries are usually 1–3 sentences, so small chunks keep
//    retrieval precise.
//  - overlap carries boundary-spanning answers (e.g. a refund rule that starts
//    at the end of one chunk) into the next chunk so retrieval can still match.
//  - we split on sentence boundaries (including the Urdu full stop "۔") rather
//    than fixed windows so chunks never cut a sentence in half.

const TARGET_CHARS = 800;
const OVERLAP_CHARS = 120;
// English sentence enders + Urdu full stop (۔ U+06D4) + common Arabic full stop
const SENTENCE_SPLIT = /(?<=[.!?۔۔\n])\s*/;

export interface Chunk {
  text: string;
  index: number;
}

export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(raw: string): Chunk[] {
  const text = normalizeText(raw);
  if (!text) return [];
  if (text.length <= TARGET_CHARS) return [{ text, index: 0 }];

  const sentences = text.split(SENTENCE_SPLIT).filter((s) => s.trim().length > 0);

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    // A single sentence longer than the target becomes its own chunk(s).
    if (sentence.length > TARGET_CHARS) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      for (let i = 0; i < sentence.length; i += TARGET_CHARS) {
        chunks.push(sentence.slice(i, i + TARGET_CHARS).trim());
      }
      continue;
    }

    if (current.length + sentence.length + 1 > TARGET_CHARS) {
      chunks.push(current.trim());
      // overlap: carry the tail of the previous chunk forward
      const tail = current.slice(-OVERLAP_CHARS);
      const cut = tail.search(/\s/);
      current = (cut >= 0 ? tail.slice(cut + 1) : tail) + " " + sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.map((text, index) => ({ text, index }));
}

// Hackathon sanity guard: keeps one giant upload from exhausting free tiers.
export const MAX_CHUNKS_PER_DOC = 300;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
