import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRAG } from "@/lib/rag/pipeline";
import { sendEscalationEmail } from "@/lib/email/escalation";

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
  let priorStatus = "active";
  if (chatId) {
    const { data: chat } = await admin
      .from("chats")
      .select("id, business_id, status")
      .eq("id", chatId)
      .single();
    if (!chat || chat.business_id !== businessId) {
      chatId = undefined;
    } else {
      priorStatus = chat.status;
    }
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
  if (!chatId) {
    return NextResponse.json(
      { error: "Could not establish conversation" },
      { status: 500 }
    );
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

  // Escalation: on a low-confidence turn, notify the business once and hand the
  // conversation to a human. On a confident turn, keep 'escalated' if a human
  // already owns it, otherwise (re)mark active.
  let emailSent = false;
  let nextStatus: "active" | "flagged" | "escalated";

  if (result.lowConfidence) {
    if (priorStatus !== "escalated") {
      const { data: transcriptRows } = await admin
        .from("messages")
        .select("role, content, created_at, confidence")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      const emailResult = await sendEscalationEmail({
        to: business.escalation_email,
        companyName: business.company_name,
        reason: result.answerable
          ? "Low retrieval confidence (question may fall outside your documents)"
          : "The AI could not ground an answer in the provided documents",
        language: result.language,
        chatId,
        transcript: (transcriptRows ?? []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          created_at: m.created_at,
          confidence: m.confidence,
        })),
      });
      emailSent = emailResult.sent;
      nextStatus = "escalated";
      await admin
        .from("chats")
        .update({
          language: result.language,
          status: nextStatus,
          escalation_reason: emailResult.sent
            ? "low_confidence"
            : `low_confidence; email failed: ${emailResult.error ?? "unknown"}`,
        })
        .eq("id", chatId);
    } else {
      // Already escalated — don't re-send, just record the new low-confidence turn.
      nextStatus = "escalated";
      await admin
        .from("chats")
        .update({ language: result.language })
        .eq("id", chatId);
    }
  } else {
    nextStatus = priorStatus === "escalated" ? "escalated" : "active";
    await admin
      .from("chats")
      .update({ language: result.language, status: nextStatus })
      .eq("id", chatId);
  }

  return NextResponse.json({
    chatId,
    answer: result.answer,
    language: result.language,
    confidence: Number(result.confidence.toFixed(3)),
    escalated: result.lowConfidence,
    status: nextStatus,
    emailSent,
  });
}
