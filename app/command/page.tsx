"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { getStore } from "@/lib/store";
import { getTherapistSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isActive } from "@/lib/requestUtils";
import { URGENCY_META, type UrgencyLevel, type Request, type Status } from "@/lib/types";
import {
  fetchFacilityRequestsDiag,
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

function UrgencyPill({ level }: { level: UrgencyLevel }) {
  const m = URGENCY_META[level];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ color: m.color, background: m.bg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

export default function CommandCenterPage() {
  const mounted = useMounted();
  const router = useRouter();
  const { profile } = useAuth();
  useStoreVersion();

  const [selectedRoom, setSelectedRoom] = useState<string | "all">("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  const store = getStore();
  const session = mounted ? getTherapistSession() : null;
  const facilityId =
    mounted && session && store.ownsFacility(session.facilityId)
      ? session.facilityId
      : mounted && store.ownsFacility(profile?.facilityId)
        ? profile!.facilityId!
        : mounted ? store.listFacilities()[0]?.id ?? null : null;

  // Initial load (for the load-error banner). Live updates + the critical beep
  // are owned by the global command center (mounted in AppNav), which keeps the
  // shared store fresh — this page re-renders from it via useStoreVersion.
  useEffect(() => {
    if (!facilityId) return;
    let active = true;
    fetchFacilityRequestsDiag(facilityId).then(({ rows, error }) => {
      if (!active) return;
      setLoadError(error);
      rows.forEach((r) => store.ingestRemoteRequest(facilityId, r));
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  if (!mounted) return <><AppNav /><main className="min-h-screen bg-offwhite" /></>;

  if (!facilityId) {
    return (
      <>
        <AppNav />
        <main className="flex min-h-[70vh] flex-col items-center justify-center gap-3 bg-offwhite px-4 text-center">
          <p className="text-xl font-bold text-navy">No facility found</p>
          <button onClick={() => router.push("/onboarding")}
            className="rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2030]">
            Set up facility
          </button>
        </main>
      </>
    );
  }

  const ws = store.getWorkspace(facilityId);
  const allActive = ws.requests.filter(isActive);
  const criticalCount = allActive.filter((r) => urgencyOf(r) === "Critical").length;

  // Per-room aggregates.
  const roomAgg = ws.rooms.map((room) => {
    const reqs = ws.requests.filter((r) => r.roomId === room.id);
    const active = reqs.filter(isActive);
    const topUrgency = active.reduce<UrgencyLevel | null>((acc, r) => {
      const u = urgencyOf(r);
      return !acc || URGENCY_META[u].rank > URGENCY_META[acc].rank ? u : acc;
    }, null);
    return { room, activeCount: active.length, topUrgency };
  });

  const visibleReqs = (selectedRoom === "all"
    ? ws.requests
    : ws.requests.filter((r) => r.roomId === selectedRoom)
  )
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Priority queue: active requests, urgency desc then oldest first.
  const queue = allActive.slice().sort((a, b) => {
    const r = rankOf(b) - rankOf(a);
    return r !== 0 ? r : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  function setStatus(req: Request, status: Status) {
    const name = session?.name ?? profile?.displayName ?? "Staff";
    store.transitionRequest(facilityId!, req.id, status, { type: "therapist", name });
    updateRequestStatus(req.id, status, name).catch(() => {});
  }

  return (
    <>
      <AppNav facilityName={ws.facility.name} />
      {loadError && (
        <div className="flex items-center justify-center gap-2 bg-[#7f1d1d] px-4 py-2 text-center text-xs font-semibold text-white">
          Can&apos;t load patient messages: {loadError}. Run the delivery test at{" "}
          <a href="/diagnostics" className="underline">/diagnostics</a>.
        </div>
      )}
      {criticalCount > 0 && (
        <div className="flex items-center justify-center gap-2 bg-[#dc2626] px-4 py-2 text-sm font-bold text-white animate-pulse">
          <span className="h-2 w-2 rounded-full bg-white" />
          {criticalCount} CRITICAL request{criticalCount !== 1 ? "s" : ""} need immediate attention
        </div>
      )}

      <main className="grid min-h-[calc(100vh-52px)] grid-cols-1 bg-offwhite lg:grid-cols-[230px_1fr_300px]">
        {/* ── Left: Rooms ── */}
        <aside className="border-r border-gray-muted bg-white">
          <div className="border-b border-gray-muted px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate/50">Rooms</p>
          </div>
          <button onClick={() => setSelectedRoom("all")}
            className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm ${selectedRoom === "all" ? "bg-navy/5 font-semibold text-navy" : "text-slate hover:bg-offwhite"}`}>
            <span>All rooms</span>
            {allActive.length > 0 && (
              <span className="rounded-full bg-navy px-2 py-0.5 text-xs font-bold text-white">{allActive.length}</span>
            )}
          </button>
          <div className="divide-y divide-gray-muted">
            {roomAgg.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-slate/40">No rooms yet. Add rooms to begin.</p>
            )}
            {roomAgg.map(({ room, activeCount, topUrgency }) => (
              <button key={room.id} onClick={() => setSelectedRoom(room.id)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left ${selectedRoom === room.id ? "bg-navy/5" : "hover:bg-offwhite"}`}>
                <div>
                  <p className="text-sm font-semibold text-navy">{room.name ?? `Room ${room.roomNumber}`}</p>
                  <p className="text-xs text-slate/50">#{room.roomNumber}</p>
                </div>
                {activeCount > 0 && topUrgency ? (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold"
                    style={{ color: URGENCY_META[topUrgency].color, background: URGENCY_META[topUrgency].bg }}>
                    {activeCount}
                  </span>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-success/40" />
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Middle: Messages ── */}
        <section className="flex flex-col">
          <div className="border-b border-gray-muted bg-white px-5 py-3">
            <p className="font-semibold text-navy">
              {selectedRoom === "all" ? "All messages" : `Room ${ws.rooms.find((r) => r.id === selectedRoom)?.roomNumber ?? ""}`}
            </p>
            <p className="text-xs text-slate/50">{visibleReqs.length} message{visibleReqs.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {visibleReqs.length === 0 && (
              <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-slate/40">
                <p className="text-sm">No messages yet.</p>
                <p className="mt-1 text-xs">Patient requests appear here in real time.</p>
              </div>
            )}
            {visibleReqs.map((req) => {
              const u = urgencyOf(req);
              const resolved = req.status === "Resolved";
              return (
                <div key={req.id}
                  className={`rounded-xl border bg-white p-4 shadow-soft ${resolved ? "opacity-60" : ""}`}
                  style={{ borderLeftWidth: 4, borderLeftColor: URGENCY_META[u].color }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-navy">Room {req.roomNumber}</span>
                        <UrgencyPill level={u} />
                        <span className="text-xs text-slate/40">{timeAgo(req.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate">
                        {req.transcript || req.aiSummary || req.notes || `${req.requestType} request`}
                      </p>
                      {req.triageReason && (
                        <p className="mt-1 text-xs text-slate/50">{req.triageReason}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-offwhite px-2 py-0.5 text-xs font-medium text-slate/60">
                      {req.status}
                    </span>
                  </div>
                  {!resolved && (
                    <div className="mt-3 flex gap-2">
                      {req.status === "New" && (
                        <button onClick={() => setStatus(req, "Acknowledged")}
                          className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0c2030]">
                          Acknowledge
                        </button>
                      )}
                      {req.status !== "Resolved" && (
                        <button onClick={() => setStatus(req, "Resolved")}
                          className="rounded-lg border border-gray-muted px-3 py-1.5 text-xs font-semibold text-slate hover:bg-offwhite">
                          Resolve
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Right: Priority queue ── */}
        <aside className="border-l border-gray-muted bg-white">
          <div className="border-b border-gray-muted px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate/50">Priority queue</p>
          </div>
          <div className="space-y-2 p-3">
            {queue.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-slate/40">All clear. No active requests.</p>
            )}
            {queue.map((req) => {
              const u = urgencyOf(req);
              return (
                <button key={req.id}
                  onClick={() => setSelectedRoom(req.roomId)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-muted px-3 py-2 text-left hover:bg-offwhite">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">Room {req.roomNumber}</p>
                    <p className="truncate text-xs text-slate/50">{req.transcript || req.requestType}</p>
                  </div>
                  <UrgencyPill level={u} />
                </button>
              );
            })}
          </div>
        </aside>
      </main>
    </>
  );
}
