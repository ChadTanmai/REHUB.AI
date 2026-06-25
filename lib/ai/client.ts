"use client";

/**
 * Hubi client — typed wrapper for the secure /api/ai route.
 *
 * Every function returns null when Hubi is unavailable (no key) or errors, so
 * callers cleanly fall back to the deterministic engine. The browser never sees
 * a key. This layer also adds two cross-cutting concerns:
 *
 *   • Audit  — every call is recorded (task, model, latency, ok) for traceability
 *   • Cache  — identical idempotent requests are reused to save credits (Layer-0)
 */

import type { UrgencyLevel } from "@/lib/types";
import { recordAudit } from "@/lib/ai/audit";

// ─── Credit optimization: tiny in-memory cache for idempotent reads ─────────
const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL = 60_000; // 1 min — safe for read-style tasks within a session

function cacheKey(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

async function callAI<T>(
  payload: Record<string, unknown>,
  opts: { timeoutMs?: number; cacheable?: boolean } = {},
): Promise<T | null> {
  const { timeoutMs = 8000, cacheable = false } = opts;
  const task = String(payload.task ?? "unknown");
  const key = cacheKey(payload);

  if (cacheable) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL) {
      recordAudit({ task, provider: "cache", model: "cache", latencyMs: 0, ok: true, outputPreview: "(cache hit)" });
      return hit.value as T;
    }
  }

  const started = Date.now();
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
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      recordAudit({ task, provider: "error", model: "none", latencyMs, ok: false, outputPreview: `HTTP ${res.status}` });
      return null;
    }
    const data = await res.json();
    if (!data || data.available === false) {
      recordAudit({ task, provider: "none", model: "none", latencyMs, ok: false, outputPreview: "AI not configured" });
      return null;
    }
    if (data.error) {
      recordAudit({ task, provider: "error", model: String(data.model ?? "?"), latencyMs, ok: false, outputPreview: String(data.error).slice(0, 80) });
      return null;
    }

    recordAudit({
      task,
      provider: String(data.model ?? "").includes("claude") ? "anthropic" : String(data.model ?? "").includes("/") ? "openrouter" : "ai",
      model: String(data.model ?? "?"),
      latencyMs,
      ok: true,
      confidence: typeof data.confidence === "number" ? data.confidence : undefined,
      outputPreview: previewOf(task, data),
    });

    if (cacheable) cache.set(key, { at: Date.now(), value: data });
    return data as T;
  } catch {
    recordAudit({ task, provider: "error", model: "none", latencyMs: Date.now() - started, ok: false, outputPreview: "network/timeout" });
    return null;
  }
}

// Short, non-identifying preview for the audit log.
function previewOf(task: string, data: Record<string, unknown>): string {
  const raw =
    (data.urgencyLevel as string | undefined) ??
    (data.staffName as string | undefined) ??
    (data.answer as string | undefined) ??
    (data.response as string | undefined) ??
    (data.reply as string | undefined) ??
    (data.summary as string | undefined) ??
    (data.insights as string | undefined) ??
    (Array.isArray(data.matchIds) ? `${(data.matchIds as unknown[]).length} matches` : undefined) ??
    "ok";
  return String(raw).slice(0, 80);
}

// ─── Public API ─────────────────────────────────────────────────────────────
export interface AITriage {
  urgencyLevel: UrgencyLevel;
  requestType?: string;
  triageReason: string;
  suggestedAction: string;
  summary: string;
  confidence?: number;
}

/** Smarter triage from free speech, with optional patient memory context. */
export function aiTriage(text: string, presetUrgency: UrgencyLevel, patientContext = ""): Promise<AITriage | null> {
  return callAI<AITriage>({ task: "triage", text, presetUrgency, patientContext }, { timeoutMs: 6000 });
}

/** One clarifying question for the patient (or done=true if none needed). */
export function aiConverse(text: string): Promise<{ reply: string; done: boolean } | null> {
  return callAI<{ reply: string; done: boolean }>({ task: "converse", text }, { timeoutMs: 6000 });
}

/** End-of-shift handoff report from a facility's requests. */
export function aiHandoff(
  facilityName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requests: any[],
): Promise<{ report: string } | null> {
  return callAI<{ report: string }>({ task: "handoff", facilityName, requests }, { timeoutMs: 30000 });
}

/** Resolve who a patient addressed: "Tell Sarah..." → { staffName }. Cacheable. */
export function aiRoute(text: string, staffNames: string[]): Promise<{ staffName: string | null } | null> {
  return callAI<{ staffName: string | null }>({ task: "route", text, staffNames }, { timeoutMs: 5000, cacheable: true });
}

/** Suggested nurse response for a request, with optional patient memory. */
export function aiCopilot(req: {
  residentName: string; summary: string; urgency: string; requestType: string; patientContext?: string;
}): Promise<{ response: string } | null> {
  return callAI<{ response: string }>({ task: "copilot", ...req }, { timeoutMs: 6000, cacheable: true });
}

/** Patient assistant — answers a question without notifying nurses. */
export function aiAsk(
  question: string,
  context: { patientName?: string; roomNumber?: string; facilityName?: string; staffContext?: string; patientContext?: string },
): Promise<{ answer: string } | null> {
  return callAI<{ answer: string }>({ task: "ask", question, ...context }, { timeoutMs: 8000 });
}

/** AI operational insights from pre-computed (free, Layer-1) stats. */
export function aiAnalytics(
  facilityName: string,
  stats: Record<string, unknown>,
): Promise<{ insights: string } | null> {
  return callAI<{ insights: string }>({ task: "analytics", facilityName, stats }, { timeoutMs: 20000 });
}

/** Natural-language search over the facility's requests. */
export function aiSearch(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requests: any[],
): Promise<{ matchIds: string[]; answer: string } | null> {
  return callAI<{ matchIds: string[]; answer: string }>({ task: "search", query, requests }, { timeoutMs: 15000 });
}
