/**
 * Deterministic, keyword-based request classifier.
 *
 * Why deterministic and not an external medical AI:
 *   - safer: it can never diagnose or give medical advice
 *   - explainable: every decision traces to a keyword and a score
 *   - private: no transcript ever leaves the device in MVP
 *   - demoable: works offline with no API keys
 *
 * The classifier ONLY converts a spoken/typed need into a structured request.
 * It never says what condition a resident has.
 */

import type { AIClassification, RequestType, UrgencyLevel } from "./types";
import {
  scoreRequest,
  scoreToPriority,
  type ScoreContext,
} from "./priorityAlgorithm";
import { triage } from "./triageEngine";

/** Keyword → request type. Order matters: earlier entries win ties. */
const TYPE_KEYWORDS: Array<{ type: RequestType; words: string[] }> = [
  {
    type: "Pain",
    words: ["pain", "hurts", "hurting", "ache", "aching", "sore", "painful"],
  },
  {
    type: "Mobility",
    words: [
      "get up",
      "getting up",
      "stand",
      "standing",
      "walk",
      "move",
      "moving",
      "dizzy",
      "dizziness",
      "fell",
      "fall",
      "balance",
      "wheelchair",
      "transfer",
    ],
  },
  {
    type: "Bathroom",
    words: ["bathroom", "restroom", "toilet", "pee", "urinate", "commode"],
  },
  {
    type: "Medication Question",
    words: ["medication", "medicine", "meds", "pill", "pills", "dose", "prescription"],
  },
  {
    type: "Water",
    words: ["water", "drink", "thirsty", "thirst"],
  },
  {
    type: "Food",
    words: ["food", "hungry", "eat", "meal", "snack", "lunch", "dinner", "breakfast"],
  },
  {
    type: "Help",
    words: ["help", "assist", "assistance", "need someone", "come here", "emergency"],
  },
];

function detectType(text: string): RequestType {
  const lower = text.toLowerCase();

  // Pain + mobility frequently co-occur; Pain wins on the label but the
  // mobility signal still raises the score via keyword modifiers.
  for (const { type, words } of TYPE_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return type;
  }
  return "Custom";
}

/**
 * Confidence is a transparent heuristic: a clear single-type match with
 * recognizable keywords scores high; vague custom text scores lower.
 */
function estimateConfidence(
  text: string,
  type: RequestType,
  matchedKeywordCount: number,
): number {
  if (!text.trim()) return 0.5;
  if (type === "Custom") return 0.6;
  // More matched signal keywords → higher confidence, capped at 0.97.
  const base = 0.78;
  const conf = base + Math.min(matchedKeywordCount, 4) * 0.05;
  return Math.min(0.97, Number(conf.toFixed(2)));
}

export interface ClassifyOptions extends ScoreContext {
  /** When set (manual button), the type is fixed and only scoring/keywords run. */
  fixedType?: RequestType;
  /** Admit-time priority floor for this patient. */
  presetUrgency?: UrgencyLevel;
}

/**
 * Classify a transcript or typed request into a full AIClassification.
 * `text` may be empty for a bare button press (then fixedType drives everything).
 */
export function classifyRequest(
  text: string,
  options: ClassifyOptions = {},
): AIClassification {
  const requestType = options.fixedType ?? detectType(text);

  const breakdown = scoreRequest(requestType, text, {
    recentUnresolvedCount: options.recentUnresolvedCount,
  });

  // Run the 5-level AI triage engine on the free text.
  const tri = triage(text, {
    presetUrgency: options.presetUrgency,
    repeatedUnresolved: options.recentUnresolvedCount,
  });

  // Reconcile the legacy 3-tier priority with the triage urgency (take the
  // stronger of the two so a Critical/High triage always lands Urgent).
  const legacyPriority = scoreToPriority(breakdown.score);
  const priority =
    tri.urgency === "Critical" || tri.urgency === "High"
      ? "Urgent"
      : tri.urgency === "Medium"
        ? maxPriority(legacyPriority, "Important")
        : legacyPriority;

  const confidence = Math.max(
    estimateConfidence(text, requestType, breakdown.detectedKeywords.length),
    tri.confidence,
  );

  const safetyFlag = breakdown.safetyFlag || tri.urgency === "Critical";

  return {
    requestType,
    priority,
    priorityScore: Math.max(breakdown.score, tri.score),
    confidence,
    staffNote: buildStaffNote(requestType, text, safetyFlag),
    detectedKeywords: Array.from(new Set([...breakdown.detectedKeywords, ...tri.matched])),
    safetyFlag,
    urgencyLevel: tri.urgency,
    triageReason: tri.reason,
    suggestedAction: tri.suggestedAction,
  };
}

function maxPriority(
  a: import("./types").Priority,
  b: import("./types").Priority,
): import("./types").Priority {
  const rank = { Routine: 1, Important: 2, Urgent: 3 } as const;
  return rank[a] >= rank[b] ? a : b;
}

/**
 * A short, factual, non-diagnostic staff note.
 * Mirrors what the resident said — it never interprets a condition.
 */
function buildStaffNote(
  type: RequestType,
  text: string,
  safetyFlag: boolean,
): string {
  const trimmed = text.trim();

  const byType: Record<RequestType, string> = {
    Pain: "Resident reports pain.",
    Mobility: "Resident needs mobility assistance.",
    Bathroom: "Resident needs help with the bathroom.",
    "Medication Question": "Resident has a medication question.",
    Water: "Resident requested water.",
    Food: "Resident requested food.",
    Help: "Resident is asking for help.",
    Custom: trimmed
      ? `Resident says: "${trimmed}".`
      : "Resident submitted a custom request.",
  };

  let note = byType[type];
  if (safetyFlag) {
    note += " Possible safety concern — review promptly.";
  }
  return note;
}
