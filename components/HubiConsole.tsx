"use client";

/**
 * Hubi Console — the staff-facing AI surface inside the command center.
 *
 * One modal, three tabs, all powered by the centralized Hubi service:
 *   • Search   — natural-language query over patient requests
 *   • Insights — free deterministic analytics + optional AI narrative
 *   • Audit    — full traceability of every AI action this session
 *
 * Credit-optimized: analytics numbers are computed locally (free); AI is only
 * called on explicit "Ask Hubi" / "Generate insights" actions.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { URGENCY_META, type Request, type UrgencyLevel } from "@/lib/types";
import { aiSearch, aiAnalytics } from "@/lib/ai/client";
import { listAudit, clearAudit, onAuditChange, type AuditEntry } from "@/lib/ai/audit";
import { HUBI_NAME } from "@/lib/ai/hubi";

type Tab = "search" | "insights" | "audit";

function urgencyOf(r: Request): UrgencyLevel {
  return r.urgencyLevel ?? (r.priority === "Urgent" ? "High" : r.priority === "Important" ? "Medium" : "Low");
}

export default function HubiConsole({
  open, onClose, facilityName, requests, onSelectRoom,
}: {
  open: boolean;
  onClose: () => void;
  facilityName: string;
  requests: Request[];
  onSelectRoom?: (roomId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("search");

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[95] flex items-start justify-center p-4 pt-[8vh]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="relative flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-gray-muted bg-gradient-to-r from-[#0c2740] to-[#1d4ed8] px-5 py-3.5 text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-sm font-black">H</span>
              <div className="flex-1">
                <p className="text-sm font-bold leading-tight">{HUBI_NAME}</p>
                <p className="text-[11px] text-white/60">AI care coordinator · {facilityName}</p>
              </div>
              <button onClick={onClose} className="rounded-lg p-1 text-white/70 hover:bg-white/15 hover:text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-muted bg-offwhite px-3 pt-2">
              {([["search", "Search"], ["insights", "Insights"], ["audit", "Audit"]] as [Tab, string][]).map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    tab === t ? "bg-white text-navy shadow-[0_-1px_0_#1d4ed8_inset]" : "text-slate/60 hover:text-navy"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === "search" && <SearchTab requests={requests} onSelectRoom={onSelectRoom} onClose={onClose} />}
              {tab === "insights" && <InsightsTab facilityName={facilityName} requests={requests} />}
              {tab === "audit" && <AuditTab />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Search tab ──────────────────────────────────────────────────────────────
function SearchTab({ requests, onSelectRoom, onClose }: {
  requests: Request[]; onSelectRoom?: (roomId: string) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [matchIds, setMatchIds] = useState<string[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const examples = ["Show all critical requests", "Who needs assistance right now?", "Requests from Room 104", "Patients who asked for water"];

  async function run(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setLoading(true); setAnswer(null); setMatchIds(null); setUnavailable(false);
    const payload = requests.map((r) => ({
      id: r.id, room: r.roomNumber, patient: r.residentName, urgency: urgencyOf(r),
      status: r.status, message: r.aiSummary || r.transcript || r.requestType, createdAt: r.createdAt,
    }));
    const res = await aiSearch(text, payload);
    setLoading(false);
    if (!res) { setUnavailable(true); return; }
    setAnswer(res.answer);
    setMatchIds(res.matchIds);
  }

  const matched = matchIds ? requests.filter((r) => matchIds.includes(r.id)) : [];

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(query)}
          placeholder="Ask Hubi anything about your requests…"
          autoFocus
          className="flex-1 rounded-xl border border-gray-muted bg-white px-4 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/40"
        />
        <button onClick={() => run(query)} disabled={loading}
          className="rounded-xl bg-gradient-to-r from-[#123a5c] to-[#1d4ed8] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? "…" : "Search"}
        </button>
      </div>

      {!answer && !loading && !unavailable && (
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button key={ex} onClick={() => run(ex)}
              className="rounded-full border border-gray-muted px-3 py-1.5 text-xs font-medium text-slate/70 hover:border-[#1d4ed8]/40 hover:bg-[#1d4ed8]/5 hover:text-[#1d4ed8]">
              {ex}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="mt-4 animate-pulse text-sm text-slate/50">Hubi is searching…</p>}
      {unavailable && (
        <p className="mt-4 rounded-xl bg-amber/10 px-4 py-3 text-sm text-amber">
          Hubi isn&apos;t configured. Add <code>ANTHROPIC_API_KEY</code> to enable AI search.
        </p>
      )}

      {answer && (
        <div className="mt-4">
          <div className="rounded-xl border border-[#1d4ed8]/15 bg-[#1d4ed8]/5 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#1d4ed8]/60">Hubi</p>
            <p className="mt-0.5 text-sm text-navy">{answer}</p>
          </div>
          <div className="mt-3 space-y-2">
            {matched.map((r) => {
              const m = URGENCY_META[urgencyOf(r)];
              return (
                <button key={r.id}
                  onClick={() => { onSelectRoom?.(r.roomId); onClose(); }}
                  className="flex w-full items-center gap-2 rounded-lg border border-gray-muted bg-white px-3 py-2 text-left hover:bg-offwhite"
                  style={{ borderLeftWidth: 3, borderLeftColor: m.color }}>
                  <span className="text-sm font-bold text-navy">Room {r.roomNumber}</span>
                  <span className="truncate text-xs text-slate/60">{r.aiSummary || r.transcript || r.requestType}</span>
                  <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: m.color, background: m.bg }}>{m.label}</span>
                </button>
              );
            })}
            {matched.length === 0 && <p className="text-sm text-slate/50">No matching requests.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Insights tab ────────────────────────────────────────────────────────────
function InsightsTab({ facilityName, requests }: { facilityName: string; requests: Request[] }) {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  // Layer-1: compute everything locally (free, instant).
  const stats = useMemo(() => {
    const total = requests.length;
    const byUrgency: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byRoom: Record<string, number> = {};
    let respSum = 0, respN = 0, escalations = 0;
    for (const r of requests) {
      const u = urgencyOf(r);
      byUrgency[u] = (byUrgency[u] ?? 0) + 1;
      byType[r.requestType] = (byType[r.requestType] ?? 0) + 1;
      byRoom[r.roomNumber] = (byRoom[r.roomNumber] ?? 0) + 1;
      if (typeof r.responseTimeMinutes === "number") { respSum += r.responseTimeMinutes; respN++; }
      if (u === "Critical" || u === "High") escalations++;
    }
    const busiestRoom = Object.entries(byRoom).sort((a, b) => b[1] - a[1])[0];
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
    return {
      total, byUrgency, byType, escalations,
      avgResponseMin: respN ? Math.round((respSum / respN) * 10) / 10 : null,
      busiestRoom: busiestRoom ? { room: busiestRoom[0], count: busiestRoom[1] } : null,
      topRequest: topType ? { type: topType[0], count: topType[1] } : null,
    };
  }, [requests]);

  async function generate() {
    setLoading(true); setUnavailable(false);
    const res = await aiAnalytics(facilityName, stats as unknown as Record<string, unknown>);
    setLoading(false);
    if (!res) { setUnavailable(true); return; }
    setInsights(res.insights);
  }

  const cards = [
    { label: "Total requests", value: stats.total },
    { label: "Escalations (High+)", value: stats.escalations },
    { label: "Avg response", value: stats.avgResponseMin != null ? `${stats.avgResponseMin}m` : "—" },
    { label: "Busiest room", value: stats.busiestRoom ? `#${stats.busiestRoom.room} (${stats.busiestRoom.count})` : "—" },
    { label: "Top request", value: stats.topRequest ? `${stats.topRequest.type} (${stats.topRequest.count})` : "—" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-muted bg-offwhite px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate/50">{c.label}</p>
            <p className="mt-0.5 text-lg font-bold text-navy">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Urgency distribution */}
      <div className="mt-3 rounded-xl border border-gray-muted bg-white p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate/50">Priority distribution</p>
        <div className="space-y-1.5">
          {(["Critical", "High", "Medium", "Low", "Informational"] as UrgencyLevel[]).map((lvl) => {
            const n = stats.byUrgency[lvl] ?? 0;
            const pct = stats.total ? Math.round((n / stats.total) * 100) : 0;
            const m = URGENCY_META[lvl];
            return (
              <div key={lvl} className="flex items-center gap-2">
                <span className="w-20 text-xs font-medium text-slate/70">{m.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-offwhite">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} />
                </div>
                <span className="w-10 text-right text-xs font-semibold text-slate/60">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={generate} disabled={loading || stats.total === 0}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#123a5c] to-[#1d4ed8] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {loading ? "Hubi is analyzing…" : "Generate AI insights"}
      </button>

      {unavailable && (
        <p className="mt-3 rounded-xl bg-amber/10 px-4 py-3 text-sm text-amber">
          Hubi isn&apos;t configured. Add <code>ANTHROPIC_API_KEY</code> to enable AI insights.
        </p>
      )}
      {insights && (
        <div className="mt-3 rounded-xl border border-[#1d4ed8]/15 bg-[#1d4ed8]/5 p-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#1d4ed8]/60">Hubi insights</p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-navy">{insights}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Audit tab ───────────────────────────────────────────────────────────────
function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  useEffect(() => {
    const refresh = () => setEntries(listAudit());
    refresh();
    return onAuditChange(refresh);
  }, []);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-navy">{entries.length} AI action{entries.length !== 1 ? "s" : ""} logged</p>
        {entries.length > 0 && (
          <button onClick={() => { clearAudit(); setEntries([]); }}
            className="text-xs font-semibold text-slate/50 hover:text-coral">Clear log</button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate/40">No AI actions yet. They appear here for full traceability.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg border border-gray-muted bg-white px-3 py-2 text-xs">
              <span className={`h-2 w-2 shrink-0 rounded-full ${e.ok ? "bg-success" : "bg-coral"}`} />
              <span className="font-bold text-navy">{e.task}</span>
              <span className="truncate text-slate/60">{e.outputPreview}</span>
              <span className="ml-auto shrink-0 text-slate/40">{e.latencyMs}ms</span>
              <span className="shrink-0 rounded bg-offwhite px-1.5 py-0.5 text-[10px] font-medium text-slate/50">{e.provider}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
