import "server-only";
import { Resend } from "resend";

// Escalation emails via Resend. Sent when the RAG pipeline can't confidently
// answer a customer, so the business gets the full transcript and can take over.
//
// Design decisions:
//  - We send at most ONE escalation email per conversation (the chat's status
//    moves to "escalated"; subsequent low-confidence turns don't re-send), so a
//    chatty customer can't spam the business inbox.
//  - Message content is HTML-escaped before rendering to prevent injection.

export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  confidence?: number | null;
}

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? "Guftagu AI <onboarding@resend.dev>";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTranscript(messages: TranscriptMessage[]): string {
  const rows = messages
    .map((m) => {
      const label = m.role === "user" ? "Customer" : "Guftagu AI";
      const color = m.role === "user" ? "#0f766e" : "#6b7280";
      const conf =
        m.role === "assistant" && typeof m.confidence === "number"
          ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px;">confidence ${(m.confidence * 100).toFixed(0)}%</div>`
          : "";
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top;white-space:nowrap;color:${color};font-weight:600;font-size:13px;">${label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#111827;direction:rtl;unicode-bidi:plaintext;text-align:left;">
            <span style="direction:auto;unicode-bidi:plaintext;display:block;">${escapeHtml(m.content)}</span>
            ${conf}
          </td>
        </tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;">${rows}</table>`;
}

export async function sendEscalationEmail(opts: {
  to: string;
  companyName: string;
  reason: string;
  language: string | null;
  chatId: string;
  transcript: TranscriptMessage[];
}): Promise<{ sent: boolean; error?: string }> {
  const { to, companyName, reason, language, chatId, transcript } = opts;

  const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/dashboard`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:16px;">
    <div style="background:#0f766e;color:#ffffff;padding:16px 20px;border-radius:8px 8px 0 0;">
      <div style="font-size:18px;font-weight:700;">گفتگو &nbsp;Guftagu AI</div>
      <div style="font-size:13px;opacity:0.9;margin-top:2px;">A customer needs a human — the AI couldn't answer confidently</div>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
      <p style="font-size:14px;color:#111827;">
        A customer chatting with <strong>${escapeHtml(companyName)}</strong> asked something the assistant
        couldn't ground in your documents, so the conversation has been flagged for you.
      </p>
      <table style="font-size:13px;color:#374151;border-collapse:collapse;margin:8px 0 16px;">
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Reason</td><td style="padding:2px 0;">${escapeHtml(reason)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Detected language</td><td style="padding:2px 0;">${escapeHtml(language ?? "unknown")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Conversation ID</td><td style="padding:2px 0;">${escapeHtml(chatId)}</td></tr>
      </table>
      <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:6px;">Transcript</div>
      ${renderTranscript(transcript)}
      <p style="margin-top:18px;">
        <a href="${dashboardUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;font-weight:600;">Open dashboard</a>
      </p>
      <p style="font-size:12px;color:#9ca3af;margin-top:20px;">
        You're receiving this because it's the escalation email for ${escapeHtml(companyName)} on Guftagu AI.
      </p>
    </div>
  </div>`;

  try {
    await client().emails.send({
      from: fromAddress(),
      to,
      subject: `[Guftagu] ${companyName}: a customer needs a human`,
      html,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}
