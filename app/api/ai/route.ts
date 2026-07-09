import Anthropic from "@anthropic-ai/sdk";
import { hubiSystem } from "@/lib/ai/hubi";

/**
 * Hubi — the single secure AI service layer for all of ReHub.
 *
 * Every AI feature in the platform consumes THIS route. No scattered prompts,
 * no duplicated provider code. Model/provider is config-driven:
 *
 *   ANTHROPIC_API_KEY   → Claude (recommended; best clinical reasoning)
 *   OPENROUTER_API_KEY  → OpenRouter (free tier; used only if Anthropic absent)
 *
 * Swap providers/models with env vars alone — zero code changes.
 * The browser NEVER sees a key; all calls are proxied here, server-side only.
 * When no key is configured every task returns { available:false } so the
 * deterministic engine takes over — AI is never a single point of failure.
 *
 * Tasks: triage · summary · converse · handoff · route · copilot · ask ·
 *        analytics · search
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Provider abstraction ──────────────────────────────────────────────────
type Provider = "anthropic" | "openrouter" | "none";

function getProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return "none";
}

// Default to Haiku 4.5 — Anthropic's cheapest model. Override with ANTHROPIC_MODEL.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
// The `effort` parameter is supported on Opus/Fable and Sonnet 4.6 — but NOT on
// Haiku 4.5 or Sonnet 4.5 (they 400). Gate it so any model works.
const SUPPORTS_EFFORT = /opus|fable/i.test(ANTHROPIC_MODEL) || /sonnet-4-6/i.test(ANTHROPIC_MODEL);

// ── Patient-safety floor ─────────────────────────────────────────────────────
// The deterministic engine (Layer 1) sets a baseline urgency. The AI (Layer 3)
// may only RAISE it. This server-side floor (Layer 4) guarantees that, no matter
// what the model returns, the result is never LESS urgent than the deterministic
// rating — even if a client forgets to enforce it.
const URGENCY_RANK: Record<string, number> = {
  Critical: 5, High: 4, Medium: 3, Low: 2, Informational: 1,
};
function mostSevereUrgency(a: string, b: string): string {
  return (URGENCY_RANK[a] ?? 0) >= (URGENCY_RANK[b] ?? 0) ? a : b;
}
const SAFE_ACTION: Record<string, string> = {
  Critical: "Respond immediately — possible medical emergency. Escalate to a nurse now.",
  High: "Attend promptly — clinical attention may be needed.",
  Medium: "Send a staff member to assist.",
  Low: "Fulfill when convenient.",
  Informational: "No action needed beyond a reply.",
};
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

export function modelFor(p: Provider): string {
  return p === "anthropic" ? ANTHROPIC_MODEL : p === "openrouter" ? OPENROUTER_MODEL : "none";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstText(resp: any): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block = (resp.content ?? []).find((b: any) => b.type === "text");
  return block?.text ?? "";
}

async function orChat(system: string, user: string, maxTokens: number, json: boolean): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY!;
  const body: Record<string, unknown> = {
    model: OPENROUTER_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  };
  if (json) body.response_format = { type: "json_object" };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://rehubai.care",
      "X-Title": "ReHub Hubi",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

/** One unified completion call. Branches by provider — the ONLY place that does. */
async function complete(
  provider: Provider,
  opts: { system: string; user: string; maxTokens: number; json?: boolean; effort?: "low" | "medium" | "high" },
): Promise<string> {
  if (provider === "anthropic") {
    const a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model: ANTHROPIC_MODEL,
      max_tokens: opts.maxTokens,
      thinking: { type: "disabled" },
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    };
    if (SUPPORTS_EFFORT) params.output_config = { effort: opts.effort ?? "low" };
    const resp = await a.messages.create(params);
    return firstText(resp).trim();
  }
  return (await orChat(opts.system, opts.user, opts.maxTokens, opts.json ?? false)).trim();
}

function extractJson(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  return match?.[0] ?? raw;
}

// ─── Triage (structured, safety-biased) ────────────────────────────────────
const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    urgencyLevel: { type: "string", enum: ["Critical", "High", "Medium", "Low", "Informational"] },
    requestType: { type: "string" },
    triageReason: { type: "string" },
    suggestedAction: { type: "string" },
    summary: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["urgencyLevel", "triageReason", "suggestedAction", "summary"],
  additionalProperties: false,
} as const;

const TRIAGE_INSTRUCTIONS =
  "Classify a patient's request into an urgency level for the nursing staff. " +
  "SAFETY FIRST: when uncertain, round UP, never down. A deterministic safety engine has already " +
  "rated this request and that rating is a FLOOR — you may RAISE the level but you must NEVER return " +
  "a level below it. Treat any sign of breathing difficulty, chest pain, fall, stroke symptoms (face " +
  "droop, slurred speech, weakness), severe bleeding, choking, seizure, or loss of consciousness as " +
  "Critical. 'High' = urgent pain, can't-move/immobility, medication needs, dizziness, or distress. " +
  "'Medium' = comfort/mobility needs (water, bathroom, repositioning, generic help). 'Low' = minor " +
  "comfort (blanket, TV, light). Keep triageReason to one short clinical sentence; suggestedAction to " +
  "a short imperative for the nurse; summary to a brief neutral paraphrase. Provide confidence 0..1. " +
  "Never invent symptoms the patient did not state.";

async function runTriage(provider: Provider, body: Record<string, unknown>) {
  const started = Date.now();
  const text = String(body.text ?? "").slice(0, 1000);
  const preset = String(body.presetUrgency ?? "Low");
  const memory = String(body.patientContext ?? "").slice(0, 600);
  const userMsg =
    (memory ? `${memory}\n\n` : "") +
    `Patient request (transcript): "${text || "(no words — button press)"}"\n` +
    `The deterministic safety engine rated this "${preset}". That is a hard FLOOR — RAISE if warranted, ` +
    `never go below it. Classify now.`;
  const system = hubiSystem(TRIAGE_INSTRUCTIONS);

  try {
    let model = modelFor(provider);
    let parsed: Record<string, unknown>;
    if (provider === "anthropic") {
      const a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      // Structured output (format) is supported on Haiku 4.5; only `effort` is not.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outputConfig: any = { format: { type: "json_schema", schema: TRIAGE_SCHEMA as never } };
      if (SUPPORTS_EFFORT) outputConfig.effort = "low";
      const resp = await a.messages.create({
        model: ANTHROPIC_MODEL, max_tokens: 400,
        thinking: { type: "disabled" },
        output_config: outputConfig,
        system, messages: [{ role: "user", content: userMsg }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      model = ANTHROPIC_MODEL;
      parsed = JSON.parse(firstText(resp));
    } else {
      const raw = await orChat(
        system +
        '\n\nRespond with ONLY valid JSON: {"urgencyLevel":"Critical|High|Medium|Low|Informational",' +
        '"requestType":"string","triageReason":"one clinical sentence","suggestedAction":"short imperative",' +
        '"summary":"brief neutral paraphrase","confidence":0.0}',
        userMsg, 400, true,
      );
      model = OPENROUTER_MODEL;
      parsed = JSON.parse(extractJson(raw));
    }

    // ── Layer 4: enforce the deterministic floor server-side ──────────────────
    const aiLevel = String(parsed.urgencyLevel ?? preset);
    const floored = mostSevereUrgency(preset, aiLevel);
    const wasFloored = floored !== aiLevel;
    if (wasFloored) {
      parsed.urgencyLevel = floored;
      // Keep an action consistent with the (higher) floored level.
      parsed.suggestedAction = SAFE_ACTION[floored] ?? parsed.suggestedAction;
      parsed.triageReason = `${parsed.triageReason ?? ""} (kept at ${floored} by safety floor).`.trim();
    }
    // Structured, PII-free log line for ops/observability.
    console.log(`[hubi.triage] model=${model} ms=${Date.now() - started} preset=${preset} ai=${aiLevel} final=${parsed.urgencyLevel} floored=${wasFloored} conf=${parsed.confidence ?? "?"} ok=true`);
    return { available: true, model, ...parsed, floored: wasFloored };
  } catch (e) {
    // ── Conservative failure: never lose or downgrade a request. Fall back to
    // the deterministic rating so the patient is still routed safely. ──────────
    console.log(`[hubi.triage] model=${modelFor(provider)} ms=${Date.now() - started} preset=${preset} ai=ERROR final=${preset} ok=false err=${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`);
    return {
      available: true,
      model: modelFor(provider),
      urgencyLevel: preset,
      requestType: "Help",
      triageReason: "AI triage unavailable — using the deterministic safety rating.",
      suggestedAction: SAFE_ACTION[preset] ?? "Send a staff member to assist.",
      summary: text.slice(0, 120),
      confidence: 0.5,
      floored: true,
    };
  }
}

// ─── Summary ───────────────────────────────────────────────────────────────
async function runSummary(provider: Provider, body: Record<string, unknown>) {
  const text = String(body.text ?? "").slice(0, 1500);
  const summary = await complete(provider, {
    system: hubiSystem("Summarize a patient nurse-call request for staff in one neutral, factual sentence. No preamble."),
    user: text, maxTokens: 200,
  });
  return { available: true, model: modelFor(provider), summary };
}

// ─── Converse (patient clarifier) ──────────────────────────────────────────
async function runConverse(provider: Provider, body: Record<string, unknown>) {
  const text = String(body.text ?? "").slice(0, 1000);
  const reply = await complete(provider, {
    system: hubiSystem(
      "The patient just sent a request to staff. Ask ONE short, gentle clarifying question that would " +
      "help the nurse respond faster (e.g. 'Can you tell me where it hurts?'). If the request is already " +
      "clear or is an emergency, reply with exactly 'OK'. One sentence, plain language, no jargon."),
    user: text || "(no words)", maxTokens: 120,
  });
  return { available: true, model: modelFor(provider), reply, done: /^ok\.?$/i.test(reply) };
}

// ─── Handoff (end-of-shift report) ─────────────────────────────────────────
async function runHandoff(provider: Provider, body: Record<string, unknown>) {
  const facility = String(body.facilityName ?? "the facility");
  const requests = Array.isArray(body.requests) ? body.requests.slice(0, 200) : [];
  const report = await complete(provider, {
    system: hubiSystem(
      "Write a concise end-of-shift handoff for the next shift. Use only the data provided. Structure: a " +
      "one-line overview, then 'Outstanding / needs follow-up' (unresolved or critical items, by room), then " +
      "'Resolved this shift' (counts + notable response times). Factual and brief. No invented patient details."),
    user: `Facility: ${facility}\nRequests (JSON):\n${JSON.stringify(requests).slice(0, 12000)}`,
    maxTokens: 1200, effort: "medium",
  });
  return { available: true, model: modelFor(provider), report };
}

// ─── Route (natural-language staff routing) ────────────────────────────────
async function runRoute(provider: Provider, body: Record<string, unknown>) {
  const text = String(body.text ?? "").slice(0, 500);
  const names = (Array.isArray(body.staffNames) ? body.staffNames as string[] : []).slice(0, 30);
  if (!names.length || !text.trim()) return { available: true, model: modelFor(provider), staffName: null };
  const raw = await complete(provider, {
    system: hubiSystem(
      `Resolve who the patient is trying to reach. Staff list: ${JSON.stringify(names)}. ` +
      `Return JSON {"staffName":"<exact name from list or null>"}. Only match when the patient explicitly ` +
      `addresses someone by name ("tell Sarah", "ask Dr. Johnson"). Generic phrases like "my nurse", ` +
      `"the nurse", "staff", "anyone" → staffName: null.`),
    user: text, maxTokens: 60, json: true,
  });
  const parsed = JSON.parse(extractJson(raw) || '{"staffName":null}');
  return { available: true, model: modelFor(provider), staffName: parsed.staffName ?? null };
}

// ─── Copilot (suggested nurse response) ────────────────────────────────────
async function runCopilot(provider: Provider, body: Record<string, unknown>) {
  const residentName = String(body.residentName ?? "the patient");
  const summary = String(body.summary ?? "").slice(0, 400);
  const urgency = String(body.urgency ?? "Medium");
  const requestType = String(body.requestType ?? "Help");
  const memory = String(body.patientContext ?? "").slice(0, 600);
  const response = await complete(provider, {
    system: hubiSystem(
      "Help a nurse craft a warm, professional reply to a patient request. Write ONE brief suggested " +
      "message the nurse can send (1-2 sentences max). Warm but efficient. No preamble — just the message."),
    user: (memory ? `${memory}\n\n` : "") +
      `Patient: ${residentName}\nUrgency: ${urgency}\nType: ${requestType}\nSummary: ${summary || "(no details)"}`,
    maxTokens: 120,
  });
  return { available: true, model: modelFor(provider), response };
}

// ─── Ask (patient assistant — no nurse notification) ───────────────────────
async function runAsk(provider: Provider, body: Record<string, unknown>) {
  const question = String(body.question ?? "").slice(0, 400);
  const patientName = String(body.patientName ?? "");
  const roomNumber = String(body.roomNumber ?? "");
  const facilityName = String(body.facilityName ?? "this facility");
  const staffContext = String(body.staffContext ?? "");
  const memory = String(body.patientContext ?? "").slice(0, 600);
  const answer = await complete(provider, {
    system: hubiSystem(
      `You're speaking with a patient at ${facilityName}` +
      (patientName ? ` — ${patientName} in room ${roomNumber}` : "") + ". " +
      (staffContext ? `${staffContext} ` : "") +
      "Answer the patient's question in 1-2 friendly, reassuring sentences. If you genuinely don't know " +
      "something specific (exact schedules, today's staff assignments), warmly tell them to ask their nurse. " +
      "Never make up facts about their care."),
    user: (memory ? `${memory}\n\n` : "") + (question || "hello"),
    maxTokens: 130,
  });
  return { available: true, model: modelFor(provider), answer };
}

// ─── Guide (public + global Hubi assistant, controlled knowledge base) ─────
// Powers the floating Hubi widget. Answers ONLY from the ReHub knowledge base
// below + the caller's page context — no hallucinations, no off-topic drift.
const REHUB_KB =
  "REHUB KNOWLEDGE BASE (the only product facts you may state):\n" +
  "- ReHub is an AI-powered communication platform for rehabilitation facilities, skilled nursing, " +
  "senior living, and post-acute care. You, Hubi, are its AI care-coordination layer.\n" +
  "- Patients: each room has a tablet. A patient taps a big button, speaks, or types a request. " +
  "They confirm before it sends. No app install, no training needed. Accessible: large text, high " +
  "contrast, voice input with typed fallback.\n" +
  "- Patient join: staff share a short facility code / link; the room tablet pairs in seconds.\n" +
  "- AI prioritization (how it works): a deterministic safety engine runs FIRST — hard rules flag " +
  "critical safety phrases (e.g. 'I can't breathe') as Critical instantly, with no AI uncertainty. " +
  "Then Hubi (AI) refines urgency, writes a summary, suggests an action, and can only RAISE urgency, " +
  "never silently lower it. Layers: Rules → Priority → AI reasoning → Response.\n" +
  "- Command center: the staff workspace. Every request shows AI summary, priority, confidence, " +
  "suggested action, and a suggested reply. Critical requests auto-surface and beep. Staff " +
  "acknowledge, assign, and resolve; every action is timestamped.\n" +
  "- Smart routing: a patient can say 'tell Sarah…' and Hubi routes it to that staff member.\n" +
  "- Voice: patients can talk to Hubi and hear spoken responses (speech-to-text + text-to-speech).\n" +
  "- Hubi also powers natural-language search ('show critical requests') and analytics " +
  "('which rooms had the most requests today?') and end-of-shift handoff summaries.\n" +
  "- Operations: rooms, staff, invite links, and analytics (response times, request volume) live " +
  "in the facility/operations area.\n" +
  "- Setup: create a facility, pair room tablets and staff devices with a code — usually under 10 minutes.\n" +
  "- Privacy: facility-scoped data, row-level security, immutable audit trail, a documented path to " +
  "HIPAA-ready deployment. Devices never talk directly; everything routes through the ReHub backend.";

async function runGuide(provider: Provider, body: Record<string, unknown>) {
  const question = String(body.question ?? "").slice(0, 400);
  const pageContext = String(body.pageContext ?? "").slice(0, 300);
  const signedIn = Boolean(body.signedIn);
  const answer = await complete(provider, {
    system: hubiSystem(
      `${REHUB_KB}\n\n` +
      (signedIn
        ? "You are the in-app Hubi assistant for a signed-in care-team member. "
        : "You are greeting a website visitor who is exploring ReHub before signing in. ") +
      (pageContext ? `The user is currently on: ${pageContext}. Tailor your answer to that context when relevant. ` : "") +
      "Answer in 1-3 warm, clear, professional sentences using ONLY the knowledge base above. " +
      "If asked something ReHub doesn't cover or that isn't in the knowledge base, briefly say it's " +
      "outside what you can help with and steer back to how ReHub improves care communication. " +
      "Never invent features, numbers, pricing, or clinical facts. Be concise and inviting."),
    user: question || "Introduce yourself and tell me what ReHub does.",
    maxTokens: 220,
  });
  return { available: true, model: modelFor(provider), answer };
}

// ─── Analytics (actionable operational insights) ───────────────────────────
async function runAnalytics(provider: Provider, body: Record<string, unknown>) {
  const facility = String(body.facilityName ?? "the facility");
  const stats = body.stats ?? {};
  const insights = await complete(provider, {
    system: hubiSystem(
      "You are reviewing operational metrics for a rehab facility. Given the pre-computed stats, write 3-5 " +
      "SHORT, actionable insight bullets for the charge nurse — trends, risks, and one concrete recommendation. " +
      "Be specific and reference the numbers. No fluff, no preamble. Use '- ' bullets."),
    user: `Facility: ${facility}\nStats (JSON):\n${JSON.stringify(stats).slice(0, 4000)}`,
    maxTokens: 400, effort: "medium",
  });
  return { available: true, model: modelFor(provider), insights };
}

// ─── Search (natural-language query over requests) ─────────────────────────
async function runSearch(provider: Provider, body: Record<string, unknown>) {
  const query = String(body.query ?? "").slice(0, 300);
  const requests = Array.isArray(body.requests) ? body.requests.slice(0, 120) : [];
  if (!query.trim()) return { available: true, model: modelFor(provider), matchIds: [], answer: "" };
  const raw = await complete(provider, {
    system: hubiSystem(
      "Staff are searching their facility's patient requests with natural language. Given the request list " +
      "(each has an id), return the ids that match the query and a ONE-sentence answer summarizing the result. " +
      'Respond with ONLY JSON: {"matchIds":["id",...],"answer":"one sentence"}. ' +
      "If none match, matchIds: [] and say so plainly."),
    user: `Query: "${query}"\nRequests (JSON):\n${JSON.stringify(requests).slice(0, 9000)}`,
    maxTokens: 500, json: true,
  });
  const parsed = JSON.parse(extractJson(raw) || '{"matchIds":[],"answer":""}');
  return {
    available: true, model: modelFor(provider),
    matchIds: Array.isArray(parsed.matchIds) ? parsed.matchIds : [],
    answer: String(parsed.answer ?? ""),
  };
}

// ─── POST handler ──────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const provider = getProvider();
  if (provider === "none") return Response.json({ available: false });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ available: true, error: "Invalid JSON" }, { status: 400 });
  }

  const task = String(body.task ?? "");
  try {
    switch (task) {
      case "triage":    return Response.json(await runTriage(provider, body));
      case "summary":   return Response.json(await runSummary(provider, body));
      case "converse":  return Response.json(await runConverse(provider, body));
      case "handoff":   return Response.json(await runHandoff(provider, body));
      case "route":     return Response.json(await runRoute(provider, body));
      case "copilot":   return Response.json(await runCopilot(provider, body));
      case "ask":       return Response.json(await runAsk(provider, body));
      case "guide":     return Response.json(await runGuide(provider, body));
      case "analytics": return Response.json(await runAnalytics(provider, body));
      case "search":    return Response.json(await runSearch(provider, body));
      default:          return Response.json({ available: true, error: "Unknown task" }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ available: true, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
