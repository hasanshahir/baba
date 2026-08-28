import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/widget/history?businessId=&chatId=&visitorId=
// Public (widget visitors have no login) but access-checked: the caller must
// present the same visitorId that created the chat.
export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  const chatId = req.nextUrl.searchParams.get("chatId");
  const visitorId = req.nextUrl.searchParams.get("visitorId");

  if (!businessId || !chatId || !visitorId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: chat } = await admin
    .from("chats")
    .select("id, business_id, visitor_id, status")
    .eq("id", chatId)
    .single();

  if (!chat || chat.business_id !== businessId || chat.visitor_id !== visitorId) {
    // Don't leak whether the chat exists — same response for any mismatch.
    return NextResponse.json({ messages: [] });
  }

  const { data: messages } = await admin
    .from("messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    messages: messages ?? [],
    status: chat.status,
  });
}
