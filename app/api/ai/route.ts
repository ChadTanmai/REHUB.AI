import Anthropic from "@anthropic-ai/sdk";

/**
 * Secure server-side Claude endpoint.
 *
 * The browser NEVER calls Anthropic directly — the API key would leak. The
 * client posts to /api/ai (same-origin, allowed by our CSP), and this route
 * calls Claude with the server-only ANTHROPIC_API_KEY. When the key is absent
 * the route returns { available: false } so every caller falls back to the
 * deterministic engine — the app keeps working until you add the key, then the
 * AI lights up automatically.
 *
 * Tasks: triage (urgency + reason + action), summary, converse (patient
 * clarifier), handoff (end-of-shift report).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

function client(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstText(resp: any): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block = (resp.content ?? []).find((b: any) => b.type === "text");
  return block?.text ?? "";
}

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

const TRIAGE_SYSTEM =
  "You are a clinical triage assistant for a rehabilitation facility's nurse-call system. " +
  "Classify a patient's spoken request into an urgency level for the nursing staff. " +
  "SAFETY FIRST: when uncertain, round UP, never down. Treat any sign of breathing difficulty, " +
  "chest pain, fall, stroke symptoms (face droop, slurred speech, weakness), severe bleeding, " +
  "or loss of consciousness as Critical. 'High' = urgent pain, medication needs, or distress. " +
  "'Medium' = comfort/mobility needs (water, bathroom, repositioning). 'Low' = minor comfort " +
  "(blanket, TV, light). Keep triageReason to one short clinical sentence; suggestedAction to a " +
  "short imperative for the nurse; summary to a brief neutral paraphrase. Never invent symptoms " +
  "the patient did not state.";

async function runTriage(a: Anthropic, body: Record<string, unknown>) {
  const text = String(body.text ?? "").slice(0, 1000);
  const preset = String(body.presetUrgency ?? "Low");
  const resp = await a.messages.create({
    model: MODEL,
    max_tokens: 400,
    thinking: { type: "disabled" },
    output_config: {
      effort: "low",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      format: { type: "json_schema", schema: TRIAGE_SCHEMA as any },
    },
    system: TRIAGE_SYSTEM,
    messages: [{
      role: "user",
      content:
        `Patient request (transcript): "${text || "(no words — button press)"}"\n` +
        `A deterministic keyword engine rated this "${preset}". You may RAISE the level if the ` +
        `wording warrants it; only lower it if the message is clearly informational/non-clinical. ` +
        `Classify it now.`,
    }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  const parsed = JSON.parse(firstText(resp));
  return { available: true, ...parsed };
}

async function runSummary(a: Anthropic, body: Record<string, unknown>) {
  const text = String(body.text ?? "").slice(0, 1500);
  const resp = await a.messages.create({
    model: MODEL,
    max_tokens: 200,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system: "Summarize a patient nurse-call request for staff in one neutral, factual sentence. No preamble.",
    messages: [{ role: "user", content: text }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { available: true, summary: firstText(resp).trim() };
}

async function runConverse(a: Anthropic, body: Record<string, unknown>) {
  const text = String(body.text ?? "").slice(0, 1000);
  const resp = await a.messages.create({
    model: MODEL,
    max_tokens: 120,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system:
      "You are a warm, calm assistant on a rehab patient's tablet. The patient just sent a request " +
      "to staff. Ask ONE short, gentle clarifying question that would help the nurse respond faster " +
      "(e.g. 'Can you tell me where it hurts?'). If the request is already clear or is an emergency, " +
      "reply with exactly 'OK'. One sentence, plain language, no medical jargon.",
    messages: [{ role: "user", content: text || "(no words)" }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  const reply = firstText(resp).trim();
  return { available: true, reply, done: /^ok\.?$/i.test(reply) };
}

async function runHandoff(a: Anthropic, body: Record<string, unknown>) {
  const facility = String(body.facilityName ?? "the facility");
  const requests = Array.isArray(body.requests) ? body.requests.slice(0, 200) : [];
  const resp = await a.messages.create({
    model: MODEL,
    max_tokens: 1200,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system:
      "You are a charge nurse writing a concise end-of-shift handoff for the next shift at a rehab " +
      "facility. Use only the data provided. Structure: a one-line overview, then 'Outstanding / " +
      "needs follow-up' (any unresolved or critical items, by room), then 'Resolved this shift' " +
      "(counts + notable response times). Be factual and brief. No invented patient details.",
    messages: [{
      role: "user",
      content: `Facility: ${facility}\nRequests (JSON):\n${JSON.stringify(requests).slice(0, 12000)}`,
    }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { available: true, report: firstText(resp).trim() };
}

export async function POST(req: Request) {
  const a = client();
  if (!a) return Response.json({ available: false });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ available: true, error: "Invalid JSON" }, { status: 400 });
  }

  const task = String(body.task ?? "");
  try {
    switch (task) {
      case "triage":   return Response.json(await runTriage(a, body));
      case "summary":  return Response.json(await runSummary(a, body));
      case "converse": return Response.json(await runConverse(a, body));
      case "handoff":  return Response.json(await runHandoff(a, body));
      default:         return Response.json({ available: true, error: "Unknown task" }, { status: 400 });
    }
  } catch (e) {
    // Surface a clean error; callers fall back to the deterministic engine.
    return Response.json({ available: true, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
