"use client";

/**
 * Global command center — a top-right bell + right-side slide-out panel that is
 * available on every staff page (mounted in AppNav). Shows live patient request
 * counts (critical / total), opens to a priority-sorted queue, and lets a nurse
 * acknowledge or resolve from anywhere without navigating to /command.
 *
 * It owns the single realtime subscription for the signed-in facility so the
 * store stays fresh app-wide; the full /command page reads the same store.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
} from "@/lib/supabase/requests";

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

export default function GlobalCommandCenter() {
  const mounted = useMounted();
  const { profile, signedIn } = useAuth();
  useStoreVersion();

  const [open, setOpen] = useState(false);
  const seenCritical = useRef<Set<string>>(new Set());

  const store = getStore();
  const session = mounted ? getTherapistSession() : null;
  const nurseName = session?.name ?? profile?.displayName ?? "Your care team";
  const facilityId =
    mounted && session && store.ownsFacility(session.facilityId)
      ? session.facilityId
      : mounted && store.ownsFacility(profile?.facilityId)
        ? profile!.facilityId!
        : mounted ? store.listFacilities()[0]?.id ?? null : null;

  useEffect(() => {
    if (!facilityId) return;
    let active = true;
    fetchFacilityRequestsDiag(facilityId).then(({ rows }) => {
      if (!active) return;
      rows.forEach((r) => store.ingestRemoteRequest(facilityId, r));
      // Seed the seen-set so we don't beep for the backlog on first load.
      rows.forEach((r) => { if (r.urgencyLevel === "Critical") seenCritical.current.add(r.id); });
    });
    const unsub = subscribeFacilityRequests(facilityId, (r) => {
      store.ingestRemoteRequest(facilityId, r);
      if (r.urgencyLevel === "Critical" && !seenCritical.current.has(r.id)) {
        seenCritical.current.add(r.id);
        beep();
      }
    }, "global");
    return () => { active = false; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  if (!mounted || !signedIn || !facilityId) return null;

  const ws = store.getWorkspace(facilityId);
  const active = ws.requests.filter(isActive);
  const criticalCount = active.filter((r) => urgencyOf(r) === "Critical").length;
  const queue = active.slice().sort((a, b) => {
    const r = rankOf(b) - rankOf(a);
    return r !== 0 ? r : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  function setStatus(req: Request, status: Status) {
    store.transitionRequest(facilityId!, req.id, status, { type: "therapist", name: nurseName });
    updateRequestStatus(req.id, status, nurseName).catch(() => {});
  }

  return (
    <>
      {/* Bell button (lives in AppNav's right cluster) */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open command center"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-gray-muted bg-white text-slate hover:bg-offwhite"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
        </svg>
        {active.length > 0 && (
          <span
            className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${criticalCount > 0 ? "animate-pulse" : ""}`}
            style={{ background: criticalCount > 0 ? "#dc2626" : "#0f2233" }}
          >
            {active.length}
          </span>
        )}
      </button>

      {/* Slide-out panel */}
      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-[380px] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-muted px-4 py-3">
              <div>
                <p className="text-sm font-bold text-navy">Command center</p>
                <p className="text-xs text-slate/50">
                  {criticalCount > 0 && <span className="font-semibold text-coral">🔴 {criticalCount} critical · </span>}
                  {active.length} active request{active.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate hover:bg-offwhite">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
              {queue.length === 0 && (
                <p className="px-2 py-10 text-center text-sm text-slate/40">All clear. No active requests.</p>
              )}
              {queue.map((req) => {
                const u = urgencyOf(req);
                const m = URGENCY_META[u];
                return (
                  <div key={req.id} className="rounded-xl border bg-white p-3 shadow-soft"
                    style={{ borderLeftWidth: 4, borderLeftColor: m.color }}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{ color: m.color, background: m.bg }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
                        {m.label}
                      </span>
                      <span className="text-sm font-bold text-navy">Room {req.roomNumber}</span>
                      <span className="ml-auto text-[11px] text-slate/40">{timeAgo(req.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-navy">{req.residentName}</p>
                    <p className="text-sm text-slate">{req.transcript || req.aiSummary || `${req.requestType} request`}</p>
                    {req.triageReason && <p className="mt-0.5 text-xs text-slate/50">{req.triageReason}</p>}
                    <div className="mt-2.5 flex gap-2">
                      {req.status === "New" && (
                        <button onClick={() => setStatus(req, "Acknowledged")}
                          className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0c2030]">
                          Acknowledge
                        </button>
                      )}
                      <button onClick={() => setStatus(req, "Resolved")}
                        className="rounded-lg border border-gray-muted px-3 py-1.5 text-xs font-semibold text-slate hover:bg-offwhite">
                        Resolve
                      </button>
                      <span className="ml-auto self-center text-[11px] font-medium text-slate/50">{req.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-muted p-3">
              <Link href="/command" onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-lg bg-offwhite px-4 py-2.5 text-sm font-semibold text-navy hover:bg-navy/5">
                Open full command center →
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
