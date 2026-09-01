import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { RetrievedChunk } from "@/lib/pinecone";
import type { SiteMap } from "@/lib/actions/site-map";

// Grounded answer generation with Anthropic Claude.
//
// We force a tool call ("provide_answer") instead of parsing free text so the
// structured signal (answerable / language / answer) is guaranteed by the API.
// This is what powers the "never hallucinate, escalate instead" guarantee:
// Claude can only answer from the supplied context, and it explicitly reports
// when the context is insufficient.

const DEFAULT_MODEL = "claude-haiku-4-5";

export type DetectedLanguage = "ur" | "roman-ur" | "en" | "other";

export interface GroundedResult {
  answer: string;
  answerable: boolean;
  language: DetectedLanguage;
  // Raw action object from the model; the caller sanitizes it against the
  // business's site map before it can reach the widget.
  rawAction?: unknown;
}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

function model(): string {
  return process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
}

function buildContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "(no context available)";
  return chunks
    .map((c, i) => `[${i + 1}] (relevance ${c.score.toFixed(3)})\n${c.text}`)
    .join("\n\n---\n\n");
}

export async function generateGroundedAnswer(opts: {
  companyName: string;
  question: string;
  chunks: RetrievedChunk[];
  history?: { role: "user" | "assistant"; content: string }[];
  siteMap?: SiteMap;
}): Promise<GroundedResult> {
  const { companyName, question, chunks, history = [], siteMap } = opts;

  const actionsSection = siteMap
    ? `

ACTIONS (you may also drive the business's website for the customer):
The business's website structure: ${JSON.stringify({
        pages: siteMap.pages,
        leadForm: siteMap.leadForm ?? null,
      })}
If the customer's message matches one of these intents, include an "action" field ALONGSIDE your answer:
1. They want to see/open/go to a page or section (e.g. "show me your graphic design services", "pricing page kahan hai"):
   action = {"type":"navigate","path":<exact path from the site map>,"anchor":<section anchor if a specific section is wanted, else omit>,"label":<short name of the destination>}
2. They want to get in touch / book / request a quote AND have shared contact details (name, email, project type, budget, requirements):
   action = {"type":"prefill","path":<leadForm.path>,"label":"Contact form","fields":{<only leadForm field keys>:<values the customer actually gave>}}
   - For dropdown fields (fields with "options"), use EXACTLY one of the listed option values; omit the field if nothing matches.
   - Never invent values the customer did not provide.
Rules:
- Still follow all grounding rules in your "answer". For an action, confirm in the answer what you're doing (same language/script as the customer), e.g. "Zaroor! Main aapko Graphic Design services ke section par le ja raha hoon."
- At most ONE action per reply. If unsure which page/section fits, do not emit an action.`
    : "";

  const system = `You are "Guftagu" (گفتگو), the customer-support assistant for "${companyName}".

STRICT GROUNDING RULES:
1. Answer ONLY using information present in the CONTEXT below. Treat the CONTEXT as the sole source of truth.
2. NEVER use outside knowledge. NEVER invent prices, dates, phone numbers, policies, or any fact not in the CONTEXT.
3. If the CONTEXT does not contain enough information to answer, set "answerable" to false. Do not guess.
4. Reply in the SAME language AND script the customer used in their latest message:
   - If they wrote Urdu in Urdu script, reply in Urdu script.
   - If they wrote Roman Urdu (Urdu words in Latin letters), reply in Roman Urdu using LATIN letters ONLY, e.g. "Hamari delivery 2-3 working days mein ho jati hai." NEVER use Urdu script in a Roman Urdu reply.
   - If they wrote English, reply in English.
5. Be warm, concise and helpful. Keep answers short (a few sentences) unless the context requires more.
6. EXCEPTION to rules 1-3: requests covered by the ACTIONS section below (navigation, contact-form fill) are always answerable — confirm the action instead of escalating.

CONTEXT:
${buildContext(chunks)}${actionsSection}`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  const resp = await client().messages.create({
    model: model(),
    max_tokens: 1024,
    system,
    messages,
    tools: [
      {
        name: "provide_answer",
        description:
          "Return the grounded customer-support answer. Set answerable=false if the context does not contain the answer. Optionally include an action to navigate the business's website or prefill its lead form.",
        input_schema: {
          type: "object" as const,
          properties: {
            answerable: {
              type: "boolean",
              description:
                "true only if the CONTEXT contains enough information to answer the customer's question, or the message is an action request (navigation / contact form).",
            },
            language: {
              type: "string",
              enum: ["ur", "roman-ur", "en", "other"],
              description: "The language/script of the customer's message.",
            },
            answer: {
              type: "string",
              description:
                "The reply to show the customer, in their language/script. If not answerable, a short polite note that a human will follow up.",
            },
            action: {
              type: "object",
              description:
                "Optional. Include only when the customer wants to open a page/section of the website or have their contact details prefilled into the lead form. Shapes: {type:'navigate', path, anchor?, label} or {type:'prefill', path, label, fields:{fieldKey:value}}. Only values from the ACTIONS section of the system prompt are valid.",
            },
          },
          required: ["answerable", "language", "answer"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "provide_answer" },
  });

  const toolBlock = resp.content.find((b) => b.type === "tool_use");
  if (toolBlock && toolBlock.type === "tool_use") {
    const input = toolBlock.input as {
      answerable?: boolean;
      language?: string;
      answer?: string;
      action?: unknown;
    };
    return {
      answer: String(input.answer ?? "").trim(),
      answerable: Boolean(input.answerable),
      language: normalizeLanguage(input.language),
      rawAction: input.action,
    };
  }

  // Fallback: model didn't use the tool — treat raw text as an answer.
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { answer: text, answerable: text.length > 0, language: "other" };
}

function normalizeLanguage(lang?: string): DetectedLanguage {
  if (lang === "ur" || lang === "roman-ur" || lang === "en" || lang === "other") {
    return lang;
  }
  return "other";
}
