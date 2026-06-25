"use client";

/**
 * Client-side wrapper for the secure /api/ai route. Every function returns null
 * when the AI is unavailable (no key configured) or errors, so callers cleanly
 * fall back to the deterministic engine. The browser never sees the API key.
 */

import type { UrgencyLevel } from "@/lib/types";

async function callAI<T>(payload: Record<string, unknown>, timeoutMs = 8000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.available === false || data.error) return null;
    return data as T;
  } catch {
    return null;
  }
}

export interface AITriage {
  urgencyLevel: UrgencyLevel;
  requestType?: string;
  triageReason: string;
  suggestedAction: string;
  summary: string;
}

/** Smarter triage from free speech. Returns null → use deterministic result. */
export function aiTriage(text: string, presetUrgency: UrgencyLevel): Promise<AITriage | null> {
  return callAI<AITriage>({ task: "triage", text, presetUrgency }, 6000);
}

/** One clarifying question for the patient (or done=true if none needed). */
export function aiConverse(text: string): Promise<{ reply: string; done: boolean } | null> {
  return callAI<{ reply: string; done: boolean }>({ task: "converse", text }, 6000);
}

/** End-of-shift handoff report from a facility's requests. */
export function aiHandoff(
  facilityName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requests: any[],
): Promise<{ report: string } | null> {
  return callAI<{ report: string }>({ task: "handoff", facilityName, requests }, 30000);
}

/**
 * Resolve who a patient is addressing in their message.
 * "Tell Sarah I need water" → { staffName: "Sarah Johnson" } or null.
 * Returns null when unavailable or when no specific name was mentioned.
 */
export function aiRoute(
  text: string,
  staffNames: string[],
): Promise<{ staffName: string | null } | null> {
  return callAI<{ staffName: string | null }>({ task: "route", text, staffNames }, 5000);
}

/**
 * Generate a suggested nurse response for a patient request.
 * Gives the nurse a warm, pre-written message they can send with one click.
 */
export function aiCopilot(req: {
  residentName: string;
  summary: string;
  urgency: string;
  requestType: string;
}): Promise<{ response: string } | null> {
  return callAI<{ response: string }>({ task: "copilot", ...req }, 6000);
}

/**
 * Patient voice assistant — answers a patient's question without notifying nurses.
 * "Who is my nurse?", "When is therapy?", "What time is dinner?" etc.
 */
export function aiAsk(
  question: string,
  context: {
    patientName?: string;
    roomNumber?: string;
    facilityName?: string;
    staffContext?: string;
  },
): Promise<{ answer: string } | null> {
  return callAI<{ answer: string }>({ task: "ask", question, ...context }, 8000);
}
