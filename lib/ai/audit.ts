"use client";

/**
 * Hubi audit log — full traceability for every AI action.
 *
 * Records task, model/provider, latency, confidence, a short output preview,
 * and whether the call fell back. Stored in a bounded localStorage ring buffer
 * (newest first, capped) so it survives reloads without a backend table.
 *
 * SECURITY: never stores API keys, full prompts, or raw patient transcripts —
 * only operational metadata and a truncated, non-identifying output preview.
 */

const KEY = "rehub.hubi.audit.v1";
const MAX = 200;

export interface AuditEntry {
  id: string;
  ts: number;            // epoch ms
  task: string;          // triage | route | copilot | ask | search | analytics | …
  provider: string;      // anthropic | openrouter | fallback | none
  model: string;         // model id, or "deterministic" for rules-layer
  latencyMs: number;
  ok: boolean;           // true = AI answered, false = unavailable/error → fallback
  confidence?: number;   // 0..1 when the task reports one
  outputPreview: string; // short, truncated, non-identifying
  promptVersion: string; // bump when prompts change, for reproducibility
}

export const PROMPT_VERSION = "hubi-1";

function read(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: AuditEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
    window.dispatchEvent(new Event("hubi-audit"));
  } catch { /* quota / disabled — ignore */ }
}

/** Append one audit entry (newest first). Returns the generated id. */
export function recordAudit(e: Omit<AuditEntry, "id" | "ts" | "promptVersion">): string {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const entry: AuditEntry = { id, ts: Date.now(), promptVersion: PROMPT_VERSION, ...e };
  write([entry, ...read()]);
  return id;
}

/** All audit entries, newest first. */
export function listAudit(): AuditEntry[] {
  return read();
}

/** Clear the audit log. */
export function clearAudit() {
  write([]);
}

/** Subscribe to audit changes (for live viewers). Returns an unsubscribe fn. */
export function onAuditChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hubi-audit", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("hubi-audit", cb);
    window.removeEventListener("storage", cb);
  };
}
