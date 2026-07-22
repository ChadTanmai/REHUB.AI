"use client";

/**
 * Global command center — the operational heart of the facility.
 *
 * A top-right bell (live critical/active counts + a "speaking now" pulse) opens
 * a physics-based slide-out panel rendered via a PORTAL to document.body. The
 * portal is essential: AppNav has `backdrop-blur`, which makes it the containing
 * block for any position:fixed child — so a panel rendered inline would be
 * clipped to the header. Portaling to <body> lets it cover the full viewport.
 *
 * It owns the single realtime subscription for the signed-in facility (so the
 * store stays fresh app-wide), surfaces a floating toast on each new request,
 * and auto-opens on a Critical.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getStore } from "@/lib/store";
import { getTherapistSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isActive } from "@/lib/requestUtils";
import { URGENCY_META, type UrgencyLevel, type Request, type Status } from "@/lib/types";
import {
  fetchFacilityRequestsDiag,
  subscribeFacilityRequests,
  updateRequestStatus,
  updateRequestTriage,
} from "@/lib/supabase/requests";
import { subscribeLiveSpeaking, type LiveSpeakingPayload } from "@/lib/supabase/liveChannel";
import { aiTriage, aiCopilot } from "@/lib/ai/client";
import { buildPatientMemory } from "@/lib/ai/memory";
import { upsertFacilityFromStore, upsertRoom } from "@/lib/supabase/facilities";
import { SUPABASE_ENABLED } from "@/lib/supabase";

const AUTO_PUBLISH_INTERVAL_MS = 60_000;

const URGENCY_ORDER: UrgencyLevel[] = ["Critical", "High", "Medium", "Low", "Informational"];

function urgencyOf(r: Request): UrgencyLevel {
  return r.urgencyLevel ?? (r.priority === "Urgent" ? "High" : r.priority === "Important" ? "Medium" : "Low");
}
function rankOf(r: Request): number {
  return URGENCY_META[urgencyOf(r)].rank;
}
function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function beep() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch { /* ignore */ }
}

interface Toast { id: string; roomNumber: string; residentName: string; urgency: UrgencyLevel; preview: string }

export default function GlobalCommandCenter() {
  const mounted = useMounted();
  const { profile, signedIn } = useAuth();
  useStoreVersion();

  const [open, setOpen] = useState(false);
  const [liveSpeakers, setLiveSpeakers] = useState<Record<string, LiveSpeakingPayload>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const seenCritical = useRef<Set<string>>(new Set());
  const seenIds = useRef<Set<string>>(new Set());
  const liveBeeped = useRef<Set<string>>(new Set());
  const aiTriaged = useRef<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const store = getStore();
  const session = mounted ? getTherapistSession() : null;
  const nurseName = session?.name ?? profile?.displayName ?? "Your care team";
  const facilityId =
    mounted && session && store.ownsFacility(session.facilityId)
      ? session.facilityId
      : mounted && store.ownsFacility(profile?.facilityId)
        ? profile!.facilityId!
        : mounted ? store.listFacilities()[0]?.id ?? null : null;

  function showToast(r: Request) {
    const t: Toast = {
      id: r.id,
      roomNumber: r.roomNumber,
      residentName: r.residentName,
      urgency: urgencyOf(r),
      preview: r.transcript || r.aiSummary || `${r.requestType} request`,
    };
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5500);
  }

  // Smarter triage: ask Claude to re-read the patient's words for every
  // free-text request (voice/typed/multi-select — a single-tap button press
  // already has an exact category and skips this). Safety-biased — urgency
  // only ever gets RAISED, never silently downgraded — and the category
  // (requestType), reason, action, and summary are all AI-refined, not
  // frozen at whatever the offline keyword matcher guessed at submission.
  // No-ops without an ANTHROPIC_API_KEY configured.
  async function enrichWithAI(reqId: string) {
    if (!facilityId || aiTriaged.current.has(reqId)) return;
    aiTriaged.current.add(reqId);
    const req = store.getWorkspace(facilityId).requests.find((r) => r.id === reqId);
    if (!req) return;
    const text = (req.transcript ?? req.aiSummary ?? "").trim();
    if (!text) return;
    const current = urgencyOf(req);
    // Patient memory: feed recent history so triage understands ongoing situations.
    const memory = buildPatientMemory(store, facilityId, { roomId: req.roomId, excludeRequestId: reqId });
    const ai = await aiTriage(text, current, memory.context);
    if (!ai) return;
    const raised = URGENCY_META[ai.urgencyLevel].rank > URGENCY_META[current].rank;
    const finalUrgency = raised ? ai.urgencyLevel : current;
    store.applyAiTriage(facilityId, reqId, {
      urgencyLevel: finalUrgency,
      requestType: ai.requestType,
      triageReason: ai.triageReason,
      suggestedAction: ai.suggestedAction,
      aiSummary: ai.summary,
    });
    updateRequestTriage(reqId, {
      urgencyLevel: finalUrgency,
      requestType: ai.requestType,
      triageReason: ai.triageReason,
      suggestedAction: ai.suggestedAction,
    }).catch(() => {});
    if (finalUrgency === "Critical" && !seenCritical.current.has(reqId)) {
      seenCritical.current.add(reqId);
      beep();
    }
  }

  useEffect(() => {
    if (!facilityId) return;
    let activeFlag = true;
    let firstLoad = true;

    const ingest = (rows: Parameters<typeof store.ingestRemoteRequests>[1]) => {
      store.ingestRemoteRequests(facilityId, rows);
      for (const r of rows) {
        if (firstLoad) { seenIds.current.add(r.id); if (r.urgencyLevel === "Critical") seenCritical.current.add(r.id); continue; }
        const stillActive = r.status === "New" || r.status === "Acknowledged" || r.status === "In Progress";
        if (r.urgencyLevel === "Critical" && stillActive && !seenCritical.current.has(r.id)) {
          seenCritical.current.add(r.id); beep();
        }
        if (stillActive) void enrichWithAI(r.id);
      }
      firstLoad = false;
    };

    fetchFacilityRequestsDiag(facilityId).then(({ rows }) => { if (activeFlag) ingest(rows); });

    const unsub = subscribeFacilityRequests(facilityId, (r) => {
      store.ingestRemoteRequest(facilityId, r);
      const isNew = !seenIds.current.has(r.id);
      seenIds.current.add(r.id);
      const stillActive = r.status === "New" || r.status === "Acknowledged" || r.status === "In Progress";
      if (isNew && stillActive) {
        const req = store.getWorkspace(facilityId).requests.find((x) => x.id === r.id);
        if (req) showToast(req);
        if (r.urgencyLevel === "Critical") setOpen(true); // auto-open on Critical
        void enrichWithAI(r.id); // smarter triage (no-op without an API key)
      }
      if (r.urgencyLevel === "Critical" && !seenCritical.current.has(r.id)) {
        seenCritical.current.add(r.id); beep();
      }
    }, "global");

    const poll = setInterval(() => {
      fetchFacilityRequestsDiag(facilityId).then(({ rows }) => { if (activeFlag) ingest(rows); });
    }, 7000);

    return () => { activeFlag = false; unsub(); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  // Auto-publish safety net: addRoom()/createFacility() already publish
  // immediately on creation, but that write can silently fail (a dropped
  // request, a transient network blip) with nothing visible to the user —
  // the local UI looks fine while the facility a patient scans into never
  // saw the new room. Every 60s while this facility is open, quietly
  // re-publish it and every room, self-healing any publish that didn't
  // actually land. No-op (and no network calls) without Supabase configured.
  useEffect(() => {
    if (!facilityId || !SUPABASE_ENABLED) return;
    let activeFlag = true;

    async function publishNow() {
      const ws = store.getWorkspace(facilityId!);
      const res = await upsertFacilityFromStore({
        id: ws.facility.id, name: ws.facility.name, facilityCode: ws.facility.facilityCode, teamName: ws.facility.teamName,
      }).catch(() => ({ ok: false }));
      if (!activeFlag || !res.ok) return;
      for (const r of ws.rooms) {
        if (!activeFlag) return;
        await upsertRoom({
          id: r.id, facilityId: facilityId!, roomNumber: r.roomNumber, displayName: r.displayName, active: r.active,
        }).catch(() => {});
      }
    }

    const interval = setInterval(publishNow, AUTO_PUBLISH_INTERVAL_MS);
    return () => { activeFlag = false; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  // Live speech via Broadcast.
  useEffect(() => {
    if (!facilityId) return;
    const unsub = subscribeLiveSpeaking(facilityId, (p) => {
      setLiveSpeakers((prev) => {
        const next = { ...prev };
        if (!p.speaking) delete next[p.roomId]; else next[p.roomId] = p;
        return next;
      });
      if (p.speaking && p.urgencyLevel === "Critical" && !liveBeeped.current.has(p.roomId)) {
        liveBeeped.current.add(p.roomId); beep(); setOpen(true);
        setTimeout(() => liveBeeped.current.delete(p.roomId), 12000);
      }
    });
    const prune = setInterval(() => {
      setLiveSpeakers((prev) => {
        const now = Date.now(); let changed = false;
        const next: Record<string, LiveSpeakingPayload> = {};
        for (const [k, v] of Object.entries(prev)) { if (now - v.ts < 6000) next[k] = v; else changed = true; }
        return changed ? next : prev;
      });
    }, 2000);
    return () => { unsub(); clearInterval(prune); };
  }, [facilityId]);

  const ws = facilityId ? store.getWorkspace(facilityId) : null;
  const active = useMemo(() => (ws ? ws.requests.filter(isActive) : []), [ws]);
  const criticalCount = active.filter((r) => urgencyOf(r) === "Critical").length;
  const speakers = Object.values(liveSpeakers).sort((a, b) => b.ts - a.ts);

  // Group active requests by urgency, plus a recent-resolved section.
  const groups = useMemo(() => {
    const sorted = active.slice().sort((a, b) => {
      const r = rankOf(b) - rankOf(a);
      return r !== 0 ? r : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    return URGENCY_ORDER.map((lvl) => ({ lvl, items: sorted.filter((r) => urgencyOf(r) === lvl) }))
      .filter((g) => g.items.length > 0);
  }, [active]);

  const resolved = useMemo(
    () => (ws ? ws.requests.filter((r) => r.status === "Resolved")
      .sort((a, b) => new Date(b.resolvedAt ?? b.createdAt).getTime() - new Date(a.resolvedAt ?? a.createdAt).getTime())
      .slice(0, 4) : []),
    [ws],
  );

  // Lightweight live activity feed synthesized from request timestamps.
  const activity = useMemo(() => {
    if (!ws) return [] as { t: number; text: string; room: string }[];
    const ev: { t: number; text: string; room: string }[] = [];
    for (const r of ws.requests) {
      ev.push({ t: new Date(r.createdAt).getTime(), text: "Request received", room: r.roomNumber });
      if (r.acknowledgedAt) ev.push({ t: new Date(r.acknowledgedAt).getTime(), text: `Acknowledged by ${r.acknowledgedBy ?? "staff"}`, room: r.roomNumber });
      if (r.resolvedAt) ev.push({ t: new Date(r.resolvedAt).getTime(), text: "Resolved", room: r.roomNumber });
    }
    return ev.sort((a, b) => b.t - a.t).slice(0, 6);
  }, [ws]);

  if (!mounted || !signedIn || !facilityId) return null;

  function setStatus(req: Request, status: Status) {
    store.transitionRequest(facilityId!, req.id, status, { type: "therapist", name: nurseName });
    updateRequestStatus(req.id, status, nurseName).catch(() => {});
  }

  const spring = { type: "spring" as const, stiffness: 360, damping: 36, mass: 0.9 };

  const panel = (
    <>
      {/* Floating toast bubble — appears even when the panel is closed */}
      <AnimatePresence>
        {toast && !open && (
          <motion.button
            key={toast.id}
            initial={{ x: 140, opacity: 0, scale: 0.92 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 140, opacity: 0, scale: 0.92 }}
            transition={spring}
            onClick={() => { setOpen(true); setToast(null); }}
            className="fixed right-4 top-20 z-[80] flex w-[320px] items-start gap-3 rounded-2xl border border-white/60 bg-white/90 p-3.5 text-left shadow-[0_20px_60px_-12px_rgba(15,34,51,0.35)] backdrop-blur-xl"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: URGENCY_META[toast.urgency].bg }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: URGENCY_META[toast.urgency].dot }} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: URGENCY_META[toast.urgency].color }}>
                  {URGENCY_META[toast.urgency].label}
                </span>
                <span className="text-sm font-bold text-navy">Room {toast.roomNumber}</span>
              </span>
              <span className="mt-0.5 block truncate text-sm text-slate">{toast.preview}</span>
              <span className="mt-1 block text-xs font-semibold text-teal">Tap to open command center →</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Slide-out panel */}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="absolute inset-0 bg-navy/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={spring}
              className="absolute right-0 top-0 flex h-[100dvh] w-[93vw] max-w-[440px] flex-col bg-offwhite shadow-[0_0_80px_-10px_rgba(15,34,51,0.55)]"
            >
              {/* Brand header */}
              <div className="relative overflow-hidden bg-navy px-5 py-4 text-white">
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-base font-bold tracking-tight">Command center</p>
                    <p className="mt-0.5 text-xs text-white/70">
                      {criticalCount > 0 && <span className="font-semibold text-[#fca5a5]">{criticalCount} critical · </span>}
                      {active.length} active{speakers.length > 0 && ` · ${speakers.length} speaking`}
                    </p>
                  </div>
                  <button onClick={() => setOpen(false)} aria-label="Close"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
                {/* Live: speaking now */}
                {speakers.length > 0 && (
                  <section>
                    <SectionHeader label="Speaking now" color="#16a34a" count={speakers.length} live />
                    <div className="mt-2 space-y-2">
                      <AnimatePresence initial={false}>
                        {speakers.map((s) => {
                          const critical = s.urgencyLevel === "Critical";
                          const c = critical ? "#dc2626" : "#16a34a";
                          return (
                            <motion.div key={`live-${s.roomId}`} layout
                              initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                              transition={spring}
                              className="rounded-2xl border-2 bg-white p-3.5 shadow-soft" style={{ borderColor: c }}>
                              <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full opacity-75" style={{ background: c }} />
                                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: c }}>
                                  {critical ? "Critical · speaking" : "Speaking"}
                                </span>
                                <span className="ml-auto text-sm font-bold text-navy">Room {s.roomNumber}</span>
                              </div>
                              <p className="mt-1.5 text-sm font-semibold text-navy">{s.residentName}</p>
                              <p className="min-h-5 text-sm text-slate">
                                {s.transcript ? <>&ldquo;{s.transcript}&rdquo;</> : <span className="text-slate/40">listening…</span>}
                              </p>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </section>
                )}

                {/* Active requests grouped by urgency */}
                {groups.map((g) => (
                  <section key={g.lvl}>
                    <SectionHeader label={URGENCY_META[g.lvl].label} color={URGENCY_META[g.lvl].color} count={g.items.length} />
                    <div className="mt-2 space-y-2">
                      <AnimatePresence initial={false}>
                        {g.items.map((req) => (
                          <RequestCard key={req.id} req={req} onAck={() => setStatus(req, "Acknowledged")} onResolve={() => setStatus(req, "Resolved")} spring={spring} />
                        ))}
                      </AnimatePresence>
                    </div>
                  </section>
                ))}

                {/* Empty state */}
                {groups.length === 0 && speakers.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-teal/30 bg-white/60 px-6 py-14 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mint">
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0f7d74" strokeWidth="1.8">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="mt-4 text-base font-bold text-navy">All patients assisted</p>
                    <p className="mt-1 text-sm text-slate/60">No active requests right now. New requests appear here instantly.</p>
                  </div>
                )}

                {/* Recently resolved */}
                {resolved.length > 0 && (
                  <section>
                    <SectionHeader label="Resolved" color="#16a34a" count={resolved.length} muted />
                    <div className="mt-2 space-y-2">
                      {resolved.map((req) => (
                        <div key={req.id} className="flex items-center gap-2 rounded-xl border border-gray-muted bg-white/70 px-3.5 py-2.5 opacity-70">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <span className="text-sm font-semibold text-navy">Room {req.roomNumber}</span>
                          <span className="truncate text-xs text-slate/50">{req.transcript || req.requestType}</span>
                          <span className="ml-auto text-xs text-slate/40">{timeAgo(req.resolvedAt ?? req.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Live activity feed */}
                {activity.length > 0 && (
                  <section>
                    <SectionHeader label="Live activity" color="#2f9e9e" />
                    <div className="mt-2 space-y-1 rounded-2xl border border-gray-muted bg-white/70 p-3">
                      {activity.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal/50" />
                          <span className="font-medium text-navy">Room {a.room}</span>
                          <span className="text-slate/60">{a.text}</span>
                          <span className="ml-auto text-slate/35">{timeAgo(new Date(a.t).toISOString())}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-muted bg-white p-3">
                <Link href="/command" onClick={() => setOpen(false)}
                  className="flex items-center justify-center rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.02] hover:bg-[#0c2030]">
                  Open full command center →
                </Link>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  return (
    <>
      {/* Bell */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open command center"
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
          criticalCount > 0 ? "border-coral/40 bg-coral/10 text-coral" : "border-gray-muted bg-white text-slate hover:border-teal/40 hover:bg-teal/5 hover:text-teal"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
        </svg>
        {active.length > 0 && (
          <span className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${criticalCount > 0 ? "animate-pulse" : ""}`}
            style={{ background: criticalCount > 0 ? "#dc2626" : "#2f9e9e" }}>
            {active.length}
          </span>
        )}
        {speakers.length > 0 && (
          <span className="absolute -bottom-0.5 -left-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
          </span>
        )}
      </button>

      {typeof document !== "undefined" && createPortal(panel, document.body)}
    </>
  );
}

function SectionHeader({ label, color, count, live, muted }: { label: string; color: string; count?: number; live?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
        style={{ color, background: muted ? "transparent" : `${color}14` }}>
        {live && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full opacity-75" style={{ background: color }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
          </span>
        )}
        {label}
      </span>
      {count !== undefined && <span className="text-xs font-semibold text-slate/40">{count}</span>}
      <span className="ml-1 h-px flex-1" style={{ background: `${color}22` }} />
    </div>
  );
}

function RequestCard({ req, onAck, onResolve, spring }: {
  req: Request; onAck: () => void; onResolve: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spring: any;
}) {
  const u = urgencyOf(req);
  const m = URGENCY_META[u];
  const [copilot, setCopilot] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadCopilot() {
    if (copilot) { setCopilotOpen((v) => !v); return; }
    if (copilotLoading) return;
    setCopilotLoading(true);
    setCopilotOpen(true);
    try {
      const res = await aiCopilot({
        residentName: req.residentName,
        summary: req.aiSummary || req.transcript || req.requestType,
        urgency: u,
        requestType: req.requestType,
      });
      if (res?.response) setCopilot(res.response);
    } catch { /* ignore */ }
    finally { setCopilotLoading(false); }
  }

  function copyResponse() {
    if (!copilot) return;
    navigator.clipboard.writeText(copilot).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div layout
      initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96, height: 0 }}
      transition={spring}
      className="overflow-hidden rounded-2xl border border-gray-muted bg-white p-3.5 shadow-soft transition-shadow hover:shadow-panel"
      style={{ borderLeftWidth: 4, borderLeftColor: m.color }}>

      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
          style={{ color: m.color, background: m.bg }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
          {m.label}
        </span>
        <span className="text-sm font-bold text-navy">Room {req.roomNumber}</span>
        <span className="ml-auto text-[11px] text-slate/40">{timeAgo(req.createdAt)}</span>
      </div>

      {/* Patient + summary */}
      <p className="mt-1.5 text-sm font-semibold text-navy">{req.residentName}</p>
      <p className="text-sm text-slate">{req.aiSummary || req.transcript || `${req.requestType} request`}</p>

      {/* AI triage reason */}
      {req.triageReason && (
        <p className="mt-0.5 text-xs text-slate/50">{req.triageReason}</p>
      )}

      {/* Suggested action — prominent */}
      {req.suggestedAction && (
        <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber/8 px-2.5 py-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2.5" className="mt-0.5 shrink-0">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-[11px] font-semibold text-amber">{req.suggestedAction}</p>
        </div>
      )}

      {/* Assignment */}
      {req.assignedTherapist && (
        <p className="mt-1 text-xs font-medium text-teal">Assigned · {req.assignedTherapist}</p>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex items-center gap-2">
        {req.status === "New" && (
          <button onClick={onAck}
            className="rounded-lg bg-navy px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft transition-transform hover:scale-[1.03] hover:bg-[#0c2030] active:scale-95">
            Acknowledge
          </button>
        )}
        <button onClick={onResolve}
          className="rounded-lg border border-gray-muted px-3.5 py-1.5 text-xs font-semibold text-slate transition-colors hover:border-success/40 hover:bg-success/5 hover:text-success active:scale-95">
          Resolve
        </button>
        {/* AI Copilot button */}
        <button onClick={loadCopilot}
          className={`ml-auto flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
            copilotOpen
              ? "border-[#7c3aed]/30 bg-[#7c3aed]/8 text-[#7c3aed]"
              : "border-gray-muted text-slate/50 hover:border-[#7c3aed]/30 hover:bg-[#7c3aed]/5 hover:text-[#7c3aed]"
          }`}>
          {copilotLoading ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-[#7c3aed]/30 border-t-[#7c3aed]" />
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-1-5h2v2h-2zm0-8h2v6h-2z" />
            </svg>
          )}
          {copilotLoading ? "Thinking…" : "Suggest reply"}
        </button>
      </div>

      {/* Copilot panel */}
      {copilotOpen && (copilot || copilotLoading) && (
        <div className="mt-2.5 rounded-xl border border-[#7c3aed]/15 bg-[#7c3aed]/5 p-3">
          {copilotLoading && !copilot ? (
            <p className="text-xs text-[#7c3aed]/60 animate-pulse">Generating suggested response…</p>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#7c3aed]/60 mb-1.5">Suggested reply</p>
              <p className="text-xs leading-relaxed text-navy">{copilot}</p>
              <button onClick={copyResponse}
                className="mt-2 flex items-center gap-1 rounded-md bg-[#7c3aed]/10 px-2.5 py-1 text-[11px] font-semibold text-[#7c3aed] hover:bg-[#7c3aed]/20 transition-colors">
                {copied ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy to clipboard
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
