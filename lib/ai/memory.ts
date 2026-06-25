"use client";

/**
 * Hubi memory — operational patient context.
 *
 * Builds a short, relevant context string from the store (recent requests,
 * current status, escalations) for a given room/patient. This is the cheap
 * Layer-1 memory: no AI call, just the facts Hubi needs to be context-aware.
 * Fed into triage / copilot / ask so responses understand ongoing situations.
 *
 * Kept deliberately compact (token-efficient) — only the last few requests.
 */

import type { RehubStore } from "@/lib/store";
import type { Request } from "@/lib/types";

function urgencyOf(r: Request): string {
  return r.urgencyLevel ?? r.priority ?? "Medium";
}

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export interface PatientMemory {
  /** Compact human-readable context for prompts (empty string when nothing relevant). */
  context: string;
  /** How many prior requests this patient/room has on record. */
  priorCount: number;
  /** True when there has been a recent Critical/High escalation. */
  recentEscalation: boolean;
}

/**
 * Build memory for a patient identified by room (and optionally name). Looks at
 * up to the last 5 requests, excluding the one currently being processed.
 */
export function buildPatientMemory(
  store: RehubStore,
  facilityId: string,
  opts: { roomId?: string; residentName?: string; excludeRequestId?: string },
): PatientMemory {
  const ws = store.getWorkspace(facilityId);
  const prior = ws.requests
    .filter((r) => {
      if (r.id === opts.excludeRequestId) return false;
      if (opts.roomId && r.roomId !== opts.roomId) return false;
      if (!opts.roomId && opts.residentName && r.residentName !== opts.residentName) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  if (prior.length === 0) {
    return { context: "", priorCount: 0, recentEscalation: false };
  }

  const recentEscalation = prior.some(
    (r) => urgencyOf(r) === "Critical" || urgencyOf(r) === "High" || urgencyOf(r) === "Urgent",
  );

  const lines = prior.map((r) => {
    const msg = (r.aiSummary || r.transcript || r.requestType || "request").slice(0, 80);
    return `- ${ago(r.createdAt)} [${urgencyOf(r)}/${r.status}] ${msg}`;
  });

  const context =
    `Patient history (most recent first, for context — do not assume it repeats):\n${lines.join("\n")}`;

  return { context, priorCount: prior.length, recentEscalation };
}
