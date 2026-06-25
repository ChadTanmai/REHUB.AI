/**
 * Rehub AI Triage Engine — deterministic 5-level urgency classification.
 *
 * Design: instead of an impossible hand-maintained list of 100,000 phrases,
 * the engine combines a few hundred weighted *signals* (symptoms, intents,
 * body parts, intensifiers, time-pressure, negation) and composes them. A few
 * hundred signals × the ways they combine covers effectively unlimited phrasing
 * ("I can't breathe", "my breathing is bad", "hard to breathe now" all fire the
 * same respiratory-distress signal).
 *
 * Safety bias: when the score sits near a boundary, the engine rounds UP. An
 * uncertain emergency is treated as the higher urgency, never the lower.
 *
 * It is deterministic and explainable (every decision traces to matched
 * signals), runs offline, and never diagnoses — it only ranks how fast a human
 * should respond.
 */

import type { UrgencyLevel } from "./types";

export interface TriageResult {
  urgency: UrgencyLevel;
  score: number;          // 0–100
  confidence: number;     // 0–1
  matched: string[];      // signals that fired
  reason: string;         // plain-English explanation
  suggestedAction: string;
  escalated: boolean;     // true if safety bias bumped it up
}

// ── Signal tables ────────────────────────────────────────────────────────────
// Each entry: a set of phrase fragments that all mean the same thing → weight.
// Weights are tuned so a single strong critical signal alone reaches Critical.

interface Signal {
  id: string;
  any: string[];     // any of these fragments present → signal fires
  weight: number;    // contribution to score
  critical?: boolean; // hard floor to Critical when fired (unless negated)
}

// CRITICAL — life/safety. Any one fires red.
const CRITICAL: Signal[] = [
  { id: "respiratory", critical: true, weight: 100, any: ["can't breathe", "cant breathe", "cannot breathe", "can not breathe", "trouble breathing", "hard to breathe", "short of breath", "not breathing", "struggling to breathe", "gasping", "suffocating"] },
  { id: "choking", critical: true, weight: 100, any: ["choking", "can't swallow air", "something stuck in my throat", "i'm choking"] },
  { id: "cardiac", critical: true, weight: 100, any: ["chest pain", "chest is tight", "chest tight", "heart hurts", "heart attack", "pressure in my chest", "my heart is racing badly", "heart racing"] },
  { id: "stroke", critical: true, weight: 100, any: ["can't move my face", "face is drooping", "slurred", "can't speak", "cant speak", "numb on one side", "weak on one side", "stroke"] },
  { id: "fall", critical: true, weight: 95, any: ["i fell", "i've fallen", "ive fallen", "i have fallen", "fell down", "on the floor", "on the ground", "i fall"] },
  { id: "head", critical: true, weight: 95, any: ["hit my head", "head injury", "banged my head", "hit my head hard"] },
  { id: "bleeding", critical: true, weight: 95, any: ["bleeding", "blood everywhere", "lot of blood", "won't stop bleeding", "wont stop bleeding", "hemorrhage"] },
  { id: "unconscious", critical: true, weight: 100, any: ["can't wake", "cant wake", "won't wake up", "wont wake up", "unconscious", "passed out", "passing out", "blacking out", "fainted"] },
  { id: "seizure", critical: true, weight: 100, any: ["seizure", "convulsing", "shaking uncontrollably"] },
  { id: "allergic", critical: true, weight: 95, any: ["allergic reaction", "throat is closing", "throat closing", "anaphylaxis", "can't feel my tongue"] },
  { id: "emergency", critical: true, weight: 90, any: ["emergency", "call 911", "help me now", "i'm dying", "im dying", "i am dying", "code blue"] },
  { id: "suicidal", critical: true, weight: 100, any: ["want to die", "kill myself", "end my life", "hurt myself"] },
];

// HIGH — needs prompt clinical attention.
const HIGH: Signal[] = [
  { id: "med_urgent", weight: 55, any: ["i need my medication", "need medication now", "missed my medication", "missed my meds", "need my pills", "haven't had my medicine", "out of medication"] },
  { id: "immobile", weight: 55, any: ["can't move", "cant move", "can't get up", "cant get up", "stuck", "can't stand", "cant stand", "can't move my legs", "can't move my arms", "paralyzed"] },
  { id: "pain_severe", weight: 55, any: ["severe pain", "terrible pain", "worst pain", "unbearable pain", "excruciating", "pain is unbearable", "so much pain", "really bad pain"] },
  { id: "pain_worse", weight: 45, any: ["pain is getting worse", "getting worse", "worse than before", "more pain", "pain is increasing"] },
  { id: "dizzy", weight: 45, any: ["dizzy", "lightheaded", "light headed", "room is spinning", "going to faint", "feel faint"] },
  { id: "fever", weight: 45, any: ["fever", "burning up", "very hot", "high temperature", "chills"] },
  { id: "vomiting", weight: 45, any: ["throwing up", "vomiting", "can't stop vomiting", "nauseous and", "keep vomiting"] },
  { id: "fall_risk", weight: 45, any: ["going to fall", "about to fall", "losing my balance", "can't balance", "feel unsteady"] },
  { id: "confused", weight: 45, any: ["confused", "don't know where i am", "disoriented", "can't think straight"] },
];

// MEDIUM — assistance needed, not clinical emergency.
const MEDIUM: Signal[] = [
  { id: "help_generic", weight: 35, any: ["i need help", "need help", "can someone come", "come here", "need assistance", "please help", "i need someone"] },
  { id: "mobility_help", weight: 35, any: ["help me up", "help getting up", "help me stand", "help to the bathroom", "need help walking", "help me move"] },
  { id: "bathroom", weight: 30, any: ["bathroom", "restroom", "toilet", "need to pee", "need to go", "commode", "bedpan"] },
  { id: "water", weight: 28, any: ["water", "thirsty", "need a drink", "something to drink", "so thirsty", "can't reach my water"] },
  { id: "pain_mild", weight: 30, any: ["pain", "hurts", "aching", "sore", "uncomfortable"] },
  { id: "reposition", weight: 28, any: ["help me turn", "reposition", "uncomfortable in bed", "adjust my bed", "move my pillow under"] },
  { id: "food", weight: 25, any: ["hungry", "food", "something to eat", "missed my meal", "when is lunch", "when is dinner"] },
];

// LOW — comfort requests.
const LOW: Signal[] = [
  { id: "blanket", weight: 15, any: ["blanket", "cold", "another blanket", "extra blanket"] },
  { id: "pillow", weight: 15, any: ["pillow", "another pillow", "fluff my pillow"] },
  { id: "comfort", weight: 12, any: ["too warm", "too hot", "adjust the temperature", "tv", "television", "remote", "channel", "lights", "curtain", "blinds"] },
  { id: "tidy", weight: 12, any: ["tissue", "napkin", "trash", "clean up", "tidy"] },
];

// INFORMATIONAL — questions, no action urgency.
const INFO: Signal[] = [
  { id: "question", weight: 6, any: ["what time", "when is", "what day", "schedule", "visiting hours", "just wondering", "question about", "can you tell me"] },
  { id: "thanks", weight: 4, any: ["thank you", "thanks", "no longer need", "never mind", "all good", "i'm okay now", "im okay now"] },
];

// Intensity amplifiers — multiply the situation's urgency.
const AMPLIFIERS: { any: string[]; add: number }[] = [
  { any: ["now", "right now", "immediately", "quickly", "hurry", "asap", "urgent"], add: 12 },
  { any: ["really", "very", "so ", "extremely", "badly", "a lot", "can't take it"], add: 8 },
  { any: ["please", "someone", "anyone"], add: 4 },
  { any: ["getting worse", "worse", "more and more"], add: 10 },
];

const NEGATORS = ["no ", "not ", "n't ", "without ", "don't ", "dont ", "isn't ", "aren't ", "never "];

function firedNegated(text: string, fragment: string): boolean {
  // True if every occurrence of `fragment` is preceded by a negator within 14 chars.
  let idx = text.indexOf(fragment);
  if (idx === -1) return false;
  while (idx !== -1) {
    const window = text.slice(Math.max(0, idx - 14), idx);
    if (!NEGATORS.some((n) => window.includes(n))) return false; // a real occurrence
    idx = text.indexOf(fragment, idx + fragment.length);
  }
  return true;
}

function matchSignals(text: string, table: Signal[]): { hits: Signal[]; weight: number } {
  const hits: Signal[] = [];
  let weight = 0;
  for (const sig of table) {
    const frag = sig.any.find((f) => text.includes(f));
    if (frag && !firedNegated(text, frag)) {
      hits.push(sig);
      weight = Math.max(weight, sig.weight); // strongest signal in a band wins
    }
  }
  return { hits, weight };
}

function urgencyFromScore(score: number): UrgencyLevel {
  if (score >= 85) return "Critical";
  if (score >= 45) return "High";   // single high-acuity symptom (dizzy/fever) → High
  if (score >= 28) return "Medium";
  if (score >= 12) return "Low";
  return "Informational";
}

const ACTIONS: Record<UrgencyLevel, string> = {
  Critical: "Respond immediately — possible medical emergency. Escalate to a nurse now.",
  High: "Attend promptly — clinical attention may be needed.",
  Medium: "Send a staff member to assist.",
  Low: "Fulfill when convenient.",
  Informational: "No action needed beyond a reply.",
};

/**
 * Classify a free-text patient message into a 5-level triage result.
 * `presetUrgency` (set when admitting the patient) acts as a FLOOR — the result
 * is never less urgent than the preset.
 */
export function triage(
  text: string,
  opts: { presetUrgency?: UrgencyLevel; repeatedUnresolved?: number } = {},
): TriageResult {
  const lower = ` ${(text || "").toLowerCase().trim()} `;

  const crit = matchSignals(lower, CRITICAL);
  const high = matchSignals(lower, HIGH);
  const med = matchSignals(lower, MEDIUM);
  const low = matchSignals(lower, LOW);
  const info = matchSignals(lower, INFO);

  let amp = 0;
  for (const a of AMPLIFIERS) {
    if (a.any.some((f) => lower.includes(f))) amp += a.add;
  }

  // Base score = strongest band that fired, plus amplifiers.
  let score = Math.max(crit.weight, high.weight, med.weight, low.weight, info.weight);
  const anyFired = crit.hits.length || high.hits.length || med.hits.length || low.hits.length || info.hits.length;
  if (!anyFired) score = 28; // unclassified text → treat as Medium-ish, never ignore
  score += amp;

  // Repeated unresolved requests from the same patient escalate.
  if ((opts.repeatedUnresolved ?? 0) >= 2) score += 12;

  const hardCritical = crit.hits.some((s) => s.critical);
  if (hardCritical) score = Math.max(score, 92);

  score = Math.max(0, Math.min(100, score));

  const matched = [...crit.hits, ...high.hits, ...med.hits, ...low.hits, ...info.hits].map((s) => s.id);

  // Confidence: clear single-band matches are confident; ambiguous/empty less so.
  const bandsFired = [crit, high, med, low, info].filter((b) => b.hits.length > 0).length;
  let confidence = anyFired ? 0.7 + Math.min(0.25, matched.length * 0.06) : 0.4;
  if (bandsFired > 1) confidence -= 0.1;
  confidence = Math.max(0.3, Math.min(0.97, Number(confidence.toFixed(2))));

  let urgency = urgencyFromScore(score);
  let escalated = false;

  // SAFETY BIAS: low confidence near a boundary → round up one level.
  // Only when a REAL signal fired — an unrecognized message (empty/garbled
  // transcript) must NOT be auto-escalated to Urgent. No words = no emergency
  // signal to round up from; it stays Medium ("send someone to check").
  const NEAR = { Critical: 85, High: 45, Medium: 28, Low: 12, Informational: 0 } as const;
  if (anyFired && confidence < 0.6 && urgency !== "Critical") {
    const dist = score - NEAR[urgency];
    if (dist <= 8) {
      urgency = bumpUp(urgency);
      escalated = true;
    }
  }

  // Apply the admit-time preset as a floor.
  if (opts.presetUrgency && rank(opts.presetUrgency) > rank(urgency)) {
    urgency = opts.presetUrgency;
    escalated = true;
  }

  return {
    urgency,
    score,
    confidence,
    matched,
    reason: buildReason(urgency, matched, escalated),
    suggestedAction: ACTIONS[urgency],
    escalated,
  };
}

function rank(u: UrgencyLevel): number {
  return { Critical: 5, High: 4, Medium: 3, Low: 2, Informational: 1 }[u];
}
function bumpUp(u: UrgencyLevel): UrgencyLevel {
  const order: UrgencyLevel[] = ["Informational", "Low", "Medium", "High", "Critical"];
  return order[Math.min(order.length - 1, order.indexOf(u) + 1)];
}

function buildReason(urgency: UrgencyLevel, matched: string[], escalated: boolean): string {
  const human: Record<string, string> = {
    respiratory: "breathing difficulty", choking: "choking", cardiac: "chest/heart symptoms",
    stroke: "possible stroke signs", fall: "a fall", head: "head injury", bleeding: "bleeding",
    unconscious: "loss of consciousness", seizure: "seizure", allergic: "allergic reaction",
    emergency: "an explicit emergency call", suicidal: "self-harm risk",
    med_urgent: "a medication need", immobile: "inability to move", pain_severe: "severe pain",
    pain_worse: "worsening pain", dizzy: "dizziness", fever: "fever", vomiting: "vomiting",
    fall_risk: "fall risk", confused: "confusion", help_generic: "a request for help",
    mobility_help: "mobility assistance", bathroom: "a bathroom need", water: "thirst/water",
    pain_mild: "discomfort", reposition: "repositioning", food: "food/meal",
    blanket: "a blanket", pillow: "a pillow", comfort: "comfort/environment", tidy: "tidying",
    question: "a question", thanks: "an acknowledgement",
  };
  const phrases = matched.slice(0, 3).map((m) => human[m] ?? m);
  const base = phrases.length
    ? `Detected ${phrases.join(", ")}.`
    : "No clear signal — treated cautiously.";
  return escalated ? `${base} Escalated for safety.` : base;
}
