/**
 * Transparent, deterministic prioritization.
 *
 * Every number here is intentional and auditable — no black-box scoring.
 * See docs/prioritization_algorithm.md for the rationale.
 */

import type { Priority, RequestType } from "./types";

/** Base priority contribution by request type. */
export const BASE_PRIORITY: Record<RequestType, number> = {
  Pain: 70,
  Help: 60,
  Mobility: 55,
  "Medication Question": 50,
  Bathroom: 40,
  Food: 20,
  Water: 15,
  Custom: 30,
};

/** Phrases that force an Urgent classification and raise a safety flag. */
export const SAFETY_PHRASES = [
  "can't breathe",
  "cant breathe",
  "cannot breathe",
  "chest pain",
  "fell",
  "fall",
  "bleeding",
  "unconscious",
  "severe pain",
];

/** Urgent keyword modifiers: +30 to +50. */
export const URGENT_KEYWORDS: Record<string, number> = {
  "can't breathe": 50,
  "cant breathe": 50,
  "cannot breathe": 50,
  "chest pain": 50,
  fell: 45,
  fall: 40,
  bleeding: 45,
  severe: 35,
  dizzy: 35,
  "cannot stand": 35,
  "can't stand": 35,
  "can't move": 35,
  "cant move": 35,
  "help now": 35,
  emergency: 50,
  "pain is bad": 30,
  "very painful": 30,
};

/** Important keyword modifiers: +10 to +25. */
export const IMPORTANT_KEYWORDS: Record<string, number> = {
  pain: 25,
  weak: 15,
  nauseous: 20,
  nausea: 20,
  bathroom: 15,
  medication: 15,
  missed: 15,
  again: 10,
  waiting: 10,
  "need help": 20,
};

/** Routine keyword modifiers: +0 to +10. */
export const ROUTINE_KEYWORDS: Record<string, number> = {
  water: 5,
  food: 5,
  blanket: 5,
  remote: 0,
  question: 5,
};

export interface ScoreBreakdown {
  base: number;
  keywordBonus: number;
  repeatedBonus: number;
  score: number;
  detectedKeywords: string[];
  safetyFlag: boolean;
}

export interface ScoreContext {
  /** Number of unresolved requests from this resident within the last 30 min. */
  recentUnresolvedCount?: number;
}

function scanKeywords(
  text: string,
  table: Record<string, number>,
): { bonus: number; matched: string[] } {
  let bonus = 0;
  const matched: string[] = [];
  for (const [phrase, weight] of Object.entries(table)) {
    if (text.includes(phrase)) {
      bonus += weight;
      matched.push(phrase);
    }
  }
  return { bonus, matched };
}

/**
 * Score a request from its type + transcript/text.
 * Returns the raw score, matched keywords and whether a safety phrase fired.
 */
export function scoreRequest(
  requestType: RequestType,
  text: string,
  ctx: ScoreContext = {},
): ScoreBreakdown {
  const lower = (text || "").toLowerCase();

  const base = BASE_PRIORITY[requestType] ?? 30;

  const urgent = scanKeywords(lower, URGENT_KEYWORDS);
  const important = scanKeywords(lower, IMPORTANT_KEYWORDS);
  const routine = scanKeywords(lower, ROUTINE_KEYWORDS);

  // De-duplicate matched keywords for display (urgent first).
  const detectedKeywords = Array.from(
    new Set([...urgent.matched, ...important.matched, ...routine.matched]),
  );

  const keywordBonus = urgent.bonus + important.bonus + routine.bonus;

  // Repeated-request modifier: 2+ unresolved within 30 min adds +15.
  const repeatedBonus = (ctx.recentUnresolvedCount ?? 0) >= 2 ? 15 : 0;

  const safetyFlag = SAFETY_PHRASES.some((p) => lower.includes(p));

  let score = base + keywordBonus + repeatedBonus;
  // A safety phrase always lands the request firmly in Urgent territory.
  if (safetyFlag) score = Math.max(score, 90);

  return {
    base,
    keywordBonus,
    repeatedBonus,
    score,
    detectedKeywords,
    safetyFlag,
  };
}

/** Map a numeric score to a priority label. */
export function scoreToPriority(score: number): Priority {
  if (score >= 70) return "Urgent";
  if (score >= 40) return "Important";
  return "Routine";
}

/**
 * Display score adds a time-waiting modifier (+5 per 10 minutes waiting).
 * This nudges queue ordering without changing the originally detected label.
 */
export function displayScore(baseScore: number, waitingMinutes: number): number {
  const timeBonus = Math.floor(waitingMinutes / 10) * 5;
  return baseScore + timeBonus;
}
