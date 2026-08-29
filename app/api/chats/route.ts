import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// GET /api/chats            → list this business's conversations
// GET /api/chats?id=<chat>  → one conversation + its full transcript
export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const chatId = req.nextUrl.searchParams.get("id");

  if (chatId) {
    const { data: chat, error } = await admin
      .from("chats")
      .select("*")
      .eq("id", chatId)
      .single();
    if (error || !chat) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (chat.business_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: messages } = await admin
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    return NextResponse.json({ chat, messages: messages ?? [] });
  }

  const { data, error } = await admin
    .from("chats")
    .select("*")
    .eq("business_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ chats: data ?? [] });
}
