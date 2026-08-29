import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { extractText } from "@/lib/rag/extract";
import {
  chunkText,
  MAX_CHUNKS_PER_DOC,
  MAX_UPLOAD_BYTES,
} from "@/lib/rag/chunker";
import { embed } from "@/lib/rag/embeddings";
import { deleteDocumentVectors, upsertChunks } from "@/lib/pinecone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireBusiness() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return null;
  return { user };
}

// POST /api/documents — multipart form with `file`
export async function POST(req: NextRequest) {
  const auth = await requireBusiness();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = auth.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 5 MB)" },
      { status: 413 }
    );
  }

  const admin = createAdminClient();

  // Create the metadata row first so the dashboard can show "processing".
  const { data: doc, error: insertError } = await admin
    .from("documents")
    .insert({
      business_id: businessId,
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      status: "processing",
    })
    .select()
    .single();

  if (insertError || !doc) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create document record" },
      { status: 500 }
    );
  }

  try {
    const { text, contentType } = await extractText(file);
    if (!text.trim()) {
      throw new Error("No readable text found in the document.");
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("Document produced no chunks.");
    if (chunks.length > MAX_CHUNKS_PER_DOC) {
      throw new Error(
        `Document too large: ${chunks.length} chunks (limit ${MAX_CHUNKS_PER_DOC}).`
      );
    }

    const vectors = await embed(
      chunks.map((c) => c.text),
      "passage"
    );

    await upsertChunks(
      businessId,
      chunks.map((c, i) => ({
        id: `${doc.id}:${c.index}`,
        values: vectors[i],
        meta: {
          businessId,
          docId: doc.id,
          filename: file.name,
          chunkIndex: c.index,
          text: c.text,
        },
      }))
    );

    await admin
      .from("documents")
      .update({ status: "ready", chunk_count: chunks.length, content_type: contentType })
      .eq("id", doc.id);

    return NextResponse.json({ id: doc.id, chunks: chunks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await admin
      .from("documents")
      .update({ status: "failed", error: message })
      .eq("id", doc.id);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

// GET /api/documents — list this business's documents
export async function GET() {
  const auth = await requireBusiness();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("documents")
    .select("*")
    .eq("business_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ documents: data });
}

// DELETE /api/documents?id=... — remove vectors + row
export async function DELETE(req: NextRequest) {
  const auth = await requireBusiness();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();

  // Ownership check before touching Pinecone.
  const { data: doc, error: fetchError } = await admin
    .from("documents")
    .select("id, business_id")
    .eq("id", id)
    .single();
  if (fetchError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.business_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteDocumentVectors(auth.user.id, id);
  await admin.from("documents").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
