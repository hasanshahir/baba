"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const GREETING: Msg = {
  role: "assistant",
  content:
    "السلام علیکم! میں گفتگو ہوں۔ آپ اردو، رومن اردو یا انگلش میں پوچھ سکتے ہیں۔\n" +
    "Assalam-o-alaikum! Ask me anything in Urdu, Roman Urdu, or English.",
};

function visitorKey(businessId: string) {
  return `guftagu_visitor_${businessId}`;
}

export default function WidgetChat({
  businessId,
  companyName,
}: {
  businessId: string;
  companyName: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [visitorId, setVisitorId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  // Visitor identity lives in OUR origin's localStorage (the iframe), scoped
  // per business, so a returning customer resumes the same conversation thread.
  useEffect(() => {
    const key = visitorKey(businessId);
    let id = window.localStorage.getItem(key);
    if (!id) {
      id =
        "v_" +
        Math.random().toString(36).slice(2, 10) +
        Date.now().toString(36);
      window.localStorage.setItem(key, id);
    }
    setVisitorId(id);

    // Resume a previous conversation if one exists for this visitor.
    const savedChatId = window.localStorage.getItem(`guftagu_chat_${businessId}`);
    if (savedChatId) {
      fetch(
        `/api/widget/history?businessId=${encodeURIComponent(businessId)}` +
          `&chatId=${encodeURIComponent(savedChatId)}` +
          `&visitorId=${encodeURIComponent(id)}`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.messages) && data.messages.length > 0) {
            setChatId(savedChatId);
            setMessages(
              data.messages.map((m: Msg) => ({
                role: m.role,
                content: m.content,
              }))
            );
            if (data.status === "escalated") setEscalated(true);
          }
        })
        .catch(() => {
          /* fresh conversation on any error */
        });
    }

    hydrated.current = true;
  }, [businessId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy || !hydrated.current) return;

      setMessages((m) => [...m, { role: "user", content: message }]);
      setInput("");
      setBusy(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId, visitorId, message, chatId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Request failed");
        setChatId(data.chatId);
        window.localStorage.setItem(`guftagu_chat_${businessId}`, data.chatId);
        if (data.escalated) setEscalated(true);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.answer },
        ]);
      } catch (err) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "معذرت، ابھی مسئلہ پیش آیا۔ براہ کرم دوبارہ کوشش کریں۔\n" +
              "Sorry, something went wrong. Please try again. " +
              (err instanceof Error ? `(${err.message})` : ""),
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [businessId, visitorId, chatId, busy]
  );

  return (
    <div className="flex h-screen flex-col bg-gray-50 font-sans">
      {/* Header */}
      <div className="flex items-center gap-3 bg-emerald-700 px-4 py-3 text-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg">
          گفتگو
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">{companyName}</p>
          <p className="text-xs text-emerald-100">
            Urdu · Roman Urdu · English support
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
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
                  ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-emerald-600 px-3.5 py-2 text-sm text-white"
                  : "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:120ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:240ms]" />
            </div>
          </div>
        )}
      </div>

      {/* Escalation notice */}
      {escalated && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <span dir="auto">
            ہماری ٹیم کو اطلاع کر دی گئی ہے — کوئی انسان جلد آپ سے رابطہ کرے گا۔
            <br />
            Our team has been notified — a human will follow up shortly.
          </span>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-gray-200 bg-white p-3"
      >
        <input
          dir="auto"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اپنا سوال لکھیں… / Type your question…"
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>

      <p className="bg-white pb-2 text-center text-[10px] text-gray-400">
        Powered by <span className="font-medium">guftagu.ai</span>
      </p>
    </div>
  );
}
