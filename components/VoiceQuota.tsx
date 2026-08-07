"use client";

import { useEffect, useState } from "react";

/**
 * Remaining ElevenLabs character quota. Reads GET /api/voice, which queries
 * ElevenLabs server-side — the API key never reaches the browser.
 *
 * Worth surfacing because the natural voice degrades to the free browser voice
 * silently when the quota runs out; staff would otherwise just notice "the
 * voice changed" mid-shift with no explanation.
 */

interface Quota {
  available: boolean;
  enabled?: boolean;
  used?: number;
  limit?: number;
  remaining?: number;
  percentUsed?: number | null;
  tier?: string;
  resetsAt?: string | null;
  reason?: string;
}

export default function VoiceQuota() {
  const [q, setQ] = useState<Quota | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/voice")
      .then((r) => r.json())
      .then((d) => { if (alive) setQ(d); })
      .catch(() => { if (alive) setQ({ available: false, reason: "Couldn't reach the voice service." }); });
    return () => { alive = false; };
  }, []);

  const pct = q?.percentUsed ?? 0;
  const low = pct >= 80;

  return (
    <div className="rounded-xl border border-gray-muted bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy">Natural voice (ElevenLabs)</h3>
        {q && (
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
              q.available && q.enabled
                ? "bg-success/10 text-success"
                : "bg-offwhite text-slate/60"
            }`}
          >
            {q.available && q.enabled ? "Active" : "Browser voice"}
          </span>
        )}
      </div>

      {!q ? (
        <p className="mt-3 text-sm text-slate/50">Checking…</p>
      ) : !q.available ? (
        <p className="mt-2 text-sm text-slate/70">
          {q.reason ?? "Not configured — patients hear the free browser voice."}
        </p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold tabular-nums text-navy">
            {(q.remaining ?? 0).toLocaleString()}
            <span className="ml-1.5 text-sm font-medium text-slate/60">characters left</span>
          </p>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-offwhite">
            <div
              className={`h-full rounded-full transition-all ${low ? "bg-coral" : "bg-teal"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate/60">
            {(q.used ?? 0).toLocaleString()} of {(q.limit ?? 0).toLocaleString()} used ({pct}%)
            {q.tier ? ` · ${q.tier} plan` : ""}
            {q.resetsAt ? ` · resets ${new Date(q.resetsAt).toLocaleDateString()}` : ""}
          </p>
          {low && (
            <p className="mt-2 rounded-lg bg-amber/10 px-3 py-2 text-xs font-medium text-[#9a6a00]">
              Running low. When it hits zero the app automatically falls back to the free browser
              voice — nothing breaks, but patients will hear a different voice.
            </p>
          )}
        </>
      )}
    </div>
  );
}
