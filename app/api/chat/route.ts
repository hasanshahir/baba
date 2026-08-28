import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRAG } from "@/lib/rag/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_TURNS = 6; // last 6 messages fed back to Claude for context

// POST /api/chat
// Body: { businessId, visitorId, message, chatId? }
// Public endpoint — the widget has no login. Business isolation is enforced by
// the caller-supplied businessId scoping the Pinecone namespace + DB writes.
export async function POST(req: NextRequest) {
  let body: {
    businessId?: string;
    visitorId?: string;
    message?: string;
    chatId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const businessId = body.businessId?.trim();
  const visitorId = body.visitorId?.trim();
  const message = body.message?.trim();

  if (!businessId || !visitorId || !message) {
    return NextResponse.json(
      { error: "businessId, visitorId and message are required" },
      { status: 400 }
    );
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("id, company_name, escalation_email")
    .eq("id", businessId)
    .single();
  if (businessError || !business) {
    return NextResponse.json({ error: "Unknown business" }, { status: 404 });
  }

  // Resolve or create the conversation.
  let chatId = body.chatId?.trim();
  if (chatId) {
    const { data: chat } = await admin
      .from("chats")
      .select("id, business_id")
      .eq("id", chatId)
      .single();
    if (!chat || chat.business_id !== businessId) chatId = undefined;
  }
  if (!chatId) {
    const { data: chat, error: chatError } = await admin
      .from("chats")
      .insert({ business_id: businessId, visitor_id: visitorId })
      .select("id")
      .single();
    if (chatError || !chat) {
      return NextResponse.json(
        { error: chatError?.message ?? "Could not start conversation" },
        { status: 500 }
      );
    }
    chatId = chat.id;
  }

  // Recent history for conversational context.
  const { data: historyRows } = await admin
    .from("messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_TURNS);
  const history = (historyRows ?? [])
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))
    .reverse();

  // Log the customer's message.
  await admin.from("messages").insert({
    chat_id: chatId,
    role: "user",
    content: message,
  });

  // Run the RAG pipeline.
  let result;
  try {
    result = await runRAG({
      businessId,
      companyName: business.company_name,
      question: message,
      history,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "RAG pipeline failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Log the assistant's answer with confidence + chunk snapshot (auditability).
  await admin.from("messages").insert({
    chat_id: chatId,
    role: "assistant",
    content: result.answer,
    confidence: result.confidence,
    retrieved_chunks: result.chunks.map((c) => ({
      text: c.text,
      score: Number(c.score.toFixed(4)),
      filename: c.filename,
    })),
  });

  // Update conversation state: detected language + escalation flag.
  await admin
    .from("chats")
    .update({
      language: result.language,
      status: result.lowConfidence ? "flagged" : "active",
      ...(result.lowConfidence
        ? { escalation_reason: "low_confidence" }
        : {}),
    })
    .eq("id", chatId);

  return NextResponse.json({
    chatId,
    answer: result.answer,
    language: result.language,
    confidence: Number(result.confidence.toFixed(3)),
    escalated: result.lowConfidence,
  });
}
