"use client";

import { useCallback, useEffect, useState } from "react";

interface ChatRow {
  id: string;
  visitor_id: string;
  language: string | null;
  status: "active" | "flagged" | "escalated";
  escalation_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  role: "user" | "assistant";
  content: string;
  confidence: number | null;
  created_at: string;
}

const STATUS_STYLES: Record<ChatRow["status"], { badge: string; row: string; label: string }> = {
  active: {
    badge: "bg-gray-100 text-gray-700",
    row: "",
    label: "Active",
  },
  flagged: {
    badge: "bg-amber-100 text-amber-800",
    row: "bg-amber-50/60",
    label: "Flagged",
  },
  escalated: {
    badge: "bg-red-100 text-red-700",
    row: "bg-red-50/60",
    label: "Escalated",
  },
};

export default function ChatsSection() {
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadChats = useCallback(async () => {
    const res = await fetch("/api/chats", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setChats(data.chats ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/chats", { cache: "no-store" });
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function openTranscript(chatId: string) {
    if (openChat === chatId) {
      setOpenChat(null);
      return;
    }
    setOpenChat(chatId);
    setLoadingMessages(true);
    setMessages([]);
    const res = await fetch(`/api/chats?id=${chatId}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
    }
    setLoadingMessages(false);
  }

  const escalatedCount = chats.filter((c) => c.status !== "active").length;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Chat logs</h2>
          <p className="mt-1 text-sm text-gray-500">
            Customer conversations.{" "}
            {escalatedCount > 0 ? (
              <span className="font-medium text-red-600">
                {escalatedCount} need{escalatedCount === 1 ? "s" : ""} your attention.
              </span>
            ) : (
              "Flagged / escalated chats are highlighted."
            )}
          </p>
        </div>
        <button
          onClick={loadChats}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : chats.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            No conversations yet. Embed the widget and try it from the demo page.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4">Started</th>
                <th className="py-2 pr-4">Visitor</th>
                <th className="py-2 pr-4">Language</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {chats.map((c) => {
                const s = STATUS_STYLES[c.status] ?? STATUS_STYLES.active;
                return (
                  <tr
                    key={c.id}
                    className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${s.row}`}
                    onClick={() => openTranscript(c.id)}
                  >
                    <td className="py-2.5 pr-4 text-gray-600">
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-gray-500">
                      {c.visitor_id.slice(0, 10)}…
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">{c.language ?? "—"}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}
                        title={c.escalation_reason ?? undefined}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-xs text-emerald-700">
                      {openChat === c.id ? "Hide" : "View"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {openChat && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Transcript</p>
            <button
              onClick={() => setOpenChat(null)}
              className="text-xs text-gray-500 hover:underline"
            >
              Close
            </button>
          </div>
          {loadingMessages ? (
            <p className="text-sm text-gray-400">Loading transcript…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-400">No messages recorded.</p>
          ) : (
            <div className="space-y-2">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user" ? "flex justify-end" : "flex justify-start"
                  }
                >
                  <div
                    dir="auto"
                    className={
                      m.role === "user"
                        ? "max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-emerald-600 px-3 py-2 text-sm text-white"
                        : "max-w-[85%] whitespace-pre-wrap rounded-xl rounded-bl-sm border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
                    }
                  >
                    {m.content}
                    {m.role === "assistant" && typeof m.confidence === "number" && (
                      <span className="mt-1 block text-[10px] text-gray-400">
                        confidence {(m.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
