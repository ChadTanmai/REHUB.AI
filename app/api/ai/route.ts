import Anthropic from "@anthropic-ai/sdk";

/**
 * Secure server-side AI endpoint — supports two providers:
 *
 *   ANTHROPIC_API_KEY   → Claude (best quality for healthcare; recommended)
 *   OPENROUTER_API_KEY  → OpenRouter (free tier available; good fallback)
 *
 * Anthropic takes priority when both keys are set.
 * The browser never sees either key. All tasks gracefully return
 * { available: false } when no key is configured.
 *
 * Tasks:
 *   triage   — urgency classification (structured JSON output)
 *   summary  — one-sentence staff summary
 *   converse — clarifying question for the patient
 *   handoff  — end-of-shift report
 *   route    — resolve "tell Sarah" → staff member name
 *   copilot  — suggested nurse response for a request
 *   ask      — patient voice assistant (answers questions without bothering nurses)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Provider detection ────────────────────────────────────────────────────
type Provider = "anthropic" | "openrouter" | "none";

function getProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return "none";
}

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

// ─── OpenRouter helper (OpenAI-compatible) ─────────────────────────────────
async function orChat(
  system: string,
  user: string,
  maxTokens: number,
  json = false,
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY!;
  const body: Record<string, unknown> = {
    model: OPENROUTER_MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (json) body.response_format = { type: "json_object" };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://rehubai.care",
      "X-Title": "ReHub AI Care Coordinator",
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

// ─── Anthropic helper ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstText(resp: any): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block = (resp.content ?? []).find((b: any) => b.type === "text");
  return block?.text ?? "";
}

function anthropic(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

// ─── Shared prompts ────────────────────────────────────────────────────────
const TRIAGE_SYSTEM =
  "You are a clinical triage assistant for a rehabilitation facility's nurse-call system. " +
  "Classify a patient's spoken request into an urgency level for the nursing staff. " +
  "SAFETY FIRST: when uncertain, round UP, never down. Treat any sign of breathing difficulty, " +
  "chest pain, fall, stroke symptoms (face droop, slurred speech, weakness), severe bleeding, " +
  "or loss of consciousness as Critical. 'High' = urgent pain, medication needs, or distress. " +
  "'Medium' = comfort/mobility needs (water, bathroom, repositioning). 'Low' = minor comfort " +
  "(blanket, TV, light). Keep triageReason to one short clinical sentence; suggestedAction to a " +
  "short imperative for the nurse; summary to a brief neutral paraphrase. Never invent symptoms.";

const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    urgencyLevel: { type: "string", enum: ["Critical", "High", "Medium", "Low", "Informational"] },
    requestType: { type: "string" },
    triageReason: { type: "string" },
    suggestedAction: { type: "string" },
    summary: { type: "string" },
  },
  required: ["urgencyLevel", "triageReason", "suggestedAction", "summary"],
  additionalProperties: false,
} as const;

// ─── Triage ────────────────────────────────────────────────────────────────
async function runTriage(provider: Provider, body: Record<string, unknown>) {
  const text = String(body.text ?? "").slice(0, 1000);
  const preset = String(body.presetUrgency ?? "Low");
  const userMsg =
    `Patient request (transcript): "${text || "(no words — button press)"}"\n` +
    `A deterministic keyword engine rated this "${preset}". You may RAISE the level if warranted; ` +
    `only lower if clearly non-clinical/informational. Classify now.`;

  if (provider === "anthropic") {
    const a = anthropic();
    const resp = await a.messages.create({
      model: ANTHROPIC_MODEL, max_tokens: 400,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema", schema: TRIAGE_SCHEMA as never } },
      system: TRIAGE_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    return { available: true, ...JSON.parse(firstText(resp)) };
  }
  // OpenRouter: instruct JSON in system prompt + enable json_object mode
  const raw = await orChat(
    TRIAGE_SYSTEM +
    '\n\nRespond with ONLY valid JSON: {"urgencyLevel":"Critical|High|Medium|Low|Informational","requestType":"string","triageReason":"one clinical sentence","suggestedAction":"short imperative for nurse","summary":"brief neutral paraphrase"}',
    userMsg, 400, true,
  );
  return { available: true, ...JSON.parse(raw) };
}

// ─── Summary ───────────────────────────────────────────────────────────────
async function runSummary(provider: Provider, body: Record<string, unknown>) {
  const text = String(body.text ?? "").slice(0, 1500);
  const system = "Summarize a patient nurse-call request for staff in one neutral, factual sentence. No preamble.";
  if (provider === "anthropic") {
    const a = anthropic();
    const resp = await a.messages.create({
      model: ANTHROPIC_MODEL, max_tokens: 200,
      thinking: { type: "disabled" }, output_config: { effort: "low" },
      system, messages: [{ role: "user", content: text }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    return { available: true, summary: firstText(resp).trim() };
  }
  return { available: true, summary: (await orChat(system, text, 200)).trim() };
}

// ─── Converse ──────────────────────────────────────────────────────────────
async function runConverse(provider: Provider, body: Record<string, unknown>) {
  const text = String(body.text ?? "").slice(0, 1000);
  const system =
    "You are a warm, calm assistant on a rehab patient's tablet. The patient just sent a request " +
    "to staff. Ask ONE short, gentle clarifying question that would help the nurse respond faster " +
    "(e.g. 'Can you tell me where it hurts?'). If the request is already clear or is an emergency, " +
    "reply with exactly 'OK'. One sentence, plain language, no medical jargon.";
  let reply: string;
  if (provider === "anthropic") {
    const a = anthropic();
    const resp = await a.messages.create({
      model: ANTHROPIC_MODEL, max_tokens: 120,
      thinking: { type: "disabled" }, output_config: { effort: "low" },
      system, messages: [{ role: "user", content: text || "(no words)" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    reply = firstText(resp).trim();
  } else {
    reply = (await orChat(system, text || "(no words)", 120)).trim();
  }
  return { available: true, reply, done: /^ok\.?$/i.test(reply) };
}

// ─── Handoff ───────────────────────────────────────────────────────────────
async function runHandoff(provider: Provider, body: Record<string, unknown>) {
  const facility = String(body.facilityName ?? "the facility");
  const requests = Array.isArray(body.requests) ? body.requests.slice(0, 200) : [];
  const system =
    "You are a charge nurse writing a concise end-of-shift handoff for the next shift at a rehab " +
    "facility. Use only the data provided. Structure: a one-line overview, then 'Outstanding / " +
    "needs follow-up' (any unresolved or critical items, by room), then 'Resolved this shift' " +
    "(counts + notable response times). Be factual and brief. No invented patient details.";
  const user = `Facility: ${facility}\nRequests (JSON):\n${JSON.stringify(requests).slice(0, 12000)}`;
  if (provider === "anthropic") {
    const a = anthropic();
    const resp = await a.messages.create({
      model: ANTHROPIC_MODEL, max_tokens: 1200,
      thinking: { type: "adaptive" }, output_config: { effort: "medium" },
      system, messages: [{ role: "user", content: user }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    return { available: true, report: firstText(resp).trim() };
  }
  return { available: true, report: (await orChat(system, user, 1200)).trim() };
}

// ─── Route — resolve "tell Sarah" → staff member ───────────────────────────
async function runRoute(provider: Provider, body: Record<string, unknown>) {
  const text = String(body.text ?? "").slice(0, 500);
  const names = (Array.isArray(body.staffNames) ? body.staffNames as string[] : []).slice(0, 30);
  if (!names.length || !text.trim()) return { available: true, staffName: null };

  const system =
    `You resolve who a rehab patient is trying to reach. Staff list: ${JSON.stringify(names)}. ` +
    `Return JSON {"staffName":"<exact name from list or null>"}. ` +
    `Only match when the patient explicitly addresses someone by name ("tell Sarah", "ask Dr. Johnson"). ` +
    `Generic phrases like "my nurse", "the nurse", "staff", "anyone" → staffName: null.`;

  let raw: string;
  if (provider === "anthropic") {
    const a = anthropic();
    const resp = await a.messages.create({
      model: ANTHROPIC_MODEL, max_tokens: 60,
      thinking: { type: "disabled" }, output_config: { effort: "low" },
      system, messages: [{ role: "user", content: text }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    raw = firstText(resp);
  } else {
    raw = await orChat(system, text, 60, true);
  }
  const match = raw.match(/\{[\s\S]*?\}/);
  const parsed = JSON.parse(match?.[0] ?? '{"staffName":null}');
  return { available: true, staffName: parsed.staffName ?? null };
}

// ─── Copilot — suggested nurse response for a request ─────────────────────
async function runCopilot(provider: Provider, body: Record<string, unknown>) {
  const residentName = String(body.residentName ?? "the patient");
  const summary = String(body.summary ?? "").slice(0, 400);
  const urgency = String(body.urgency ?? "Medium");
  const requestType = String(body.requestType ?? "Help");
  const system =
    "You are a care coordinator helping a nurse craft a warm, professional response to a patient request. " +
    "Write ONE brief suggested message the nurse can send (1-2 sentences max). Warm but efficient. " +
    "No preamble or meta-commentary — just the message.";
  const user = `Patient: ${residentName}\nUrgency: ${urgency}\nType: ${requestType}\nSummary: ${summary || "(no details)"}`;
  let response: string;
  if (provider === "anthropic") {
    const a = anthropic();
    const resp = await a.messages.create({
      model: ANTHROPIC_MODEL, max_tokens: 120,
      thinking: { type: "disabled" }, output_config: { effort: "low" },
      system, messages: [{ role: "user", content: user }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    response = firstText(resp).trim();
  } else {
    response = (await orChat(system, user, 120)).trim();
  }
  return { available: true, response };
}

// ─── Ask — patient voice assistant (no nurse notification) ─────────────────
async function runAsk(provider: Provider, body: Record<string, unknown>) {
  const question = String(body.question ?? "").slice(0, 400);
  const patientName = String(body.patientName ?? "");
  const roomNumber = String(body.roomNumber ?? "");
  const facilityName = String(body.facilityName ?? "this facility");
  const staffContext = String(body.staffContext ?? "");
  const system =
    `You are a warm, caring AI care assistant at ${facilityName} rehab facility. ` +
    (patientName ? `You're speaking with ${patientName} in room ${roomNumber}. ` : "") +
    (staffContext ? `${staffContext} ` : "") +
    "Answer the patient's question in 1-2 friendly, reassuring sentences. " +
    "If you genuinely don't know something specific (exact schedules, specific staff assignments today), " +
    "warmly tell them to ask their nurse. Never make up facts about their care.";
  let answer: string;
  if (provider === "anthropic") {
    const a = anthropic();
    const resp = await a.messages.create({
      model: ANTHROPIC_MODEL, max_tokens: 120,
      thinking: { type: "disabled" }, output_config: { effort: "low" },
      system, messages: [{ role: "user", content: question || "hello" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    answer = firstText(resp).trim();
  } else {
    answer = (await orChat(system, question || "hello", 120)).trim();
  }
  return { available: true, answer };
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
      case "triage":   return Response.json(await runTriage(provider, body));
      case "summary":  return Response.json(await runSummary(provider, body));
      case "converse": return Response.json(await runConverse(provider, body));
      case "handoff":  return Response.json(await runHandoff(provider, body));
      case "route":    return Response.json(await runRoute(provider, body));
      case "copilot":  return Response.json(await runCopilot(provider, body));
      case "ask":      return Response.json(await runAsk(provider, body));
      default:         return Response.json({ available: true, error: "Unknown task" }, { status: 400 });
    }
  } catch (e) {
    return Response.json(
      { available: true, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
