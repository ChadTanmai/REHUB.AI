"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { getStore } from "@/lib/store";
import { getTherapistSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";
import { useAuth } from "@/lib/auth/AuthProvider";
import { upsertFacilityFromStore, upsertRoom } from "@/lib/supabase/facilities";
import type { Room, RoomStatus, RoomType } from "@/lib/types";

const ROOM_TYPES: RoomType[] = ["Standard", "Private", "ICU", "Recovery", "Therapy", "Observation"];

const STATUS_META: Record<RoomStatus, { label: string; color: string; dot: string }> = {
  Available:          { label: "Available",         color: "text-success", dot: "bg-success" },
  "Partially Occupied": { label: "Partial",         color: "text-teal",   dot: "bg-teal" },
  Occupied:           { label: "Occupied",          color: "text-slate",  dot: "bg-slate/40" },
  Maintenance:        { label: "Maintenance",       color: "text-amber",  dot: "bg-amber" },
  Cleaning:           { label: "Cleaning",          color: "text-amber",  dot: "bg-amber" },
  Offline:            { label: "Offline",           color: "text-slate/40", dot: "bg-slate/20" },
  Restricted:         { label: "Restricted",        color: "text-coral",  dot: "bg-coral" },
};

function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const m = STATUS_META[status] ?? STATUS_META["Available"];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${m.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

const EMPTY_FORM = {
  roomNumber: "",
  name: "",
  floor: "",
  wing: "",
  roomType: "Standard" as RoomType,
  capacity: 1,
  description: "",
};

export default function RoomsPage() {
  const mounted = useMounted();
  const router = useRouter();
  const { profile, signedIn } = useAuth();
  useStoreVersion();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncOk, setSyncOk] = useState(false);
  const [syncing, setSyncing] = useState(false);

  if (!mounted) return <div className="min-h-screen bg-offwhite" />;

  const store = getStore();
  // Tenant isolation: only operate on a facility this account owns.
  const session = getTherapistSession();
  const facilityId =
    session && store.ownsFacility(session.facilityId)
      ? session.facilityId
      : store.ownsFacility(profile?.facilityId)
        ? profile!.facilityId!
        : store.listFacilities()[0]?.id ?? null;

  if (!facilityId) {
    return (
      <div className="flex min-h-screen flex-col bg-offwhite">
        <AppNav />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-xl font-bold text-navy">No facility found</p>
          <p className="text-sm text-slate/70">Set up your facility first to manage rooms.</p>
          <button onClick={() => router.push("/onboarding")}
            className="rounded-xl bg-navy px-6 py-3 font-semibold text-white hover:bg-[#0c2030]">
            Set up facility
          </button>
        </div>
      </div>
    );
  }

  const ws = store.getWorkspace(facilityId);
  const rooms = ws.rooms.filter((r) => r.active !== false);

  function validateForm() {
    if (!form.roomNumber.trim()) return "Room number is required.";
    const dup = rooms.find(
      (r) => r.roomNumber === form.roomNumber.trim() && r.id !== editingId,
    );
    if (dup) return `Room ${form.roomNumber} already exists.`;
    return "";
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const err = validateForm();
    if (err) { setFormError(err); return; }
    setSaving(true);
    setFormError("");
    setSyncMsg("");
    const room = store.addRoom(facilityId!, {
      roomNumber: form.roomNumber.trim(),
      displayName: form.name.trim() || `Room ${form.roomNumber.trim()}`,
      name: form.name.trim() || `Room ${form.roomNumber.trim()}`,
      floor: form.floor.trim() || undefined,
      wing: form.wing.trim() || undefined,
      roomType: form.roomType,
      capacity: Math.max(1, form.capacity),
      description: form.description.trim() || undefined,
    });
    setForm(EMPTY_FORM);
    setShowAdd(false);
    setSaving(false);

    // Publish to Supabase so patients on other devices can pick this room.
    // We AWAIT and report the real result — no silent failures. We rely on the
    // live Supabase session inside upsertFacilityFromStore (not a stale flag).
    const res = await publishFacilityAndRoom(room);
    setSyncOk(res.ok);
    setSyncMsg(res.message);
  }

  // Push the facility + a single room to the cloud, returning a human result.
  async function publishFacilityAndRoom(room: Room): Promise<{ ok: boolean; message: string }> {
    const fac = store.getWorkspace(facilityId!).facility;
    const facRes = await upsertFacilityFromStore({
      id: fac.id, name: fac.name, facilityCode: fac.facilityCode, teamName: fac.teamName,
    });
    if (!facRes.ok) {
      return { ok: false, message: `Room saved on this device, but cloud sync failed (facility): ${facRes.error}. Patients on other phones won't see it yet.` };
    }
    const roomRes = await upsertRoom({
      id: room.id,
      facilityId: facilityId!,
      roomNumber: room.roomNumber,
      displayName: room.displayName,
      active: room.active !== false,
    });
    if (!roomRes.ok) {
      return { ok: false, message: `Room saved on this device, but cloud sync failed (room): ${roomRes.error}. Patients on other phones won't see it yet.` };
    }
    return { ok: true, message: `Synced to cloud — patients can now pick Room ${room.roomNumber} from any device using code ${fac.facilityCode}.` };
  }

  // Re-publish the facility + ALL active rooms (for rooms created before sync,
  // or to recover after a network failure). Surfaces the real outcome.
  async function syncAll() {
    setSyncing(true);
    setSyncMsg("");
    const fac = store.getWorkspace(facilityId!).facility;
    const facRes = await upsertFacilityFromStore({
      id: fac.id, name: fac.name, facilityCode: fac.facilityCode, teamName: fac.teamName,
    });
    if (!facRes.ok) {
      setSyncOk(false);
      setSyncMsg(`Cloud sync failed (facility): ${facRes.error}`);
      setSyncing(false);
      return;
    }
    let failed = 0;
    let lastErr = "";
    for (const r of rooms) {
      const rr = await upsertRoom({
        id: r.id, facilityId: facilityId!, roomNumber: r.roomNumber,
        displayName: r.displayName ?? r.name ?? `Room ${r.roomNumber}`, active: r.active !== false,
      });
      if (!rr.ok) { failed++; lastErr = rr.error ?? ""; }
    }
    setSyncOk(failed === 0);
    setSyncMsg(
      failed === 0
        ? `Published ${fac.facilityCode} with ${rooms.length} room${rooms.length !== 1 ? "s" : ""}. Patients can now join from any device.`
        : `Published facility, but ${failed} room${failed !== 1 ? "s" : ""} failed to sync: ${lastErr}`,
    );
    setSyncing(false);
  }

  function handleStatusChange(room: Room, status: RoomStatus) {
    store.updateRoom(facilityId!, room.id, { roomStatus: status });
  }

  function handleDelete(roomId: string) {
    store.deleteRoom(facilityId!, roomId);
    setDeleteConfirm(null);
  }

  const available = rooms.filter(r => r.roomStatus === "Available" || !r.roomStatus).length;
  const occupied = rooms.filter(r => r.roomStatus === "Occupied" || r.roomStatus === "Partially Occupied").length;

  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      <AppNav facilityName={ws.facility.name} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Rooms</h1>
            <p className="mt-0.5 text-sm text-slate/60">
              {rooms.length} room{rooms.length !== 1 ? "s" : ""} · {available} available · {occupied} occupied
            </p>
          </div>
          <div className="flex items-center gap-2">
            {rooms.length > 0 && (
              <button
                onClick={syncAll}
                disabled={syncing}
                className="flex items-center gap-2 rounded-xl border border-teal/40 bg-teal/5 px-4 py-2.5 text-sm font-semibold text-teal hover:bg-teal/10 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9h-3M3 12a9 9 0 0 0 9 9m-9-9a9 9 0 0 1 9-9m-9 9h3" strokeLinecap="round" />
                  <path d="M16 8l2-2 2 2M8 16l-2 2-2-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {syncing ? "Syncing…" : "Sync all to cloud"}
              </button>
            )}
            <button
              onClick={() => { setShowAdd(true); setEditingId(null); setForm(EMPTY_FORM); setFormError(""); }}
              className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2030]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Add room
            </button>
          </div>
        </div>

        {/* Cloud sync result — tells the admin whether patients on other devices
            can actually see these rooms. No more silent failures. */}
        {syncMsg && (
          <div className={`mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            syncOk
              ? "border-success/30 bg-success/5 text-success"
              : "border-coral/30 bg-coral/5 text-coral"
          }`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
              {syncOk
                ? <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                : <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" /></>}
            </svg>
            <span className="font-medium">{syncMsg}</span>
          </div>
        )}
        {!signedIn && (
          <div className="mb-5 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 text-sm font-medium text-amber">
            You&apos;re not signed in, so rooms stay on this device only. Sign in to publish rooms so patients on other phones can see them.
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="mb-6 rounded-2xl border border-teal/30 bg-white p-5 shadow-soft">
            <h2 className="mb-4 font-semibold text-navy">New room</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate">Room number *</label>
                <input value={form.roomNumber} onChange={e => setForm(f => ({ ...f, roomNumber: e.target.value }))}
                  placeholder="101" className="input" autoFocus />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate">Room name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Room 101" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate">Type</label>
                <select value={form.roomType} onChange={e => setForm(f => ({ ...f, roomType: e.target.value as RoomType }))}
                  className="input">
                  {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate">Floor</label>
                <input value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}
                  placeholder="1" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate">Wing</label>
                <input value={form.wing} onChange={e => setForm(f => ({ ...f, wing: e.target.value }))}
                  placeholder="North" className="input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate">Capacity</label>
                <input type="number" min={1} max={10} value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))}
                  className="input" />
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold text-slate">Description (optional)</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Notes about this room" className="input" />
            </div>
            {formError && <p className="mt-2 text-sm text-coral">{formError}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={saving}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c2030] disabled:opacity-50">
                {saving ? "Adding…" : "Add room"}
              </button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="rounded-lg border border-gray-muted px-4 py-2 text-sm font-medium text-slate hover:bg-offwhite">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Empty state */}
        {rooms.length === 0 && !showAdd && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-muted bg-white py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-navy/5 text-navy">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-navy">No rooms yet</p>
            <p className="mt-1 text-sm text-slate/60">
              Add rooms so patients can select them when they join.
            </p>
            <button onClick={() => setShowAdd(true)}
              className="mt-4 rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2030]">
              Add your first room
            </button>
          </div>
        )}

        {/* Rooms grid */}
        {rooms.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              const status = room.roomStatus ?? "Available";
              const cap = room.capacity ?? 1;
              const count = room.patientCount ?? 0;
              const pct = Math.min(1, count / cap);
              return (
                <div key={room.id}
                  className="group rounded-2xl border border-gray-muted bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-panel">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold text-navy">{room.name ?? `Room ${room.roomNumber}`}</p>
                      <p className="text-sm font-medium text-slate/50">#{room.roomNumber}</p>
                    </div>
                    <span key={status} className="rehub-rise">
                      <RoomStatusBadge status={status} />
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-slate/60">
                    {room.floor && <span>Floor {room.floor}</span>}
                    {room.wing && <span>· {room.wing} wing</span>}
                    {room.roomType && room.roomType !== "Standard" && <span>· {room.roomType}</span>}
                  </div>

                  {/* Capacity bar */}
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate/60">
                      <span>{count} / {cap} patient{cap !== 1 ? "s" : ""}</span>
                      <span>{cap - count} slot{cap - count !== 1 ? "s" : ""} open</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-offwhite">
                      <div className="h-full rounded-full bg-teal transition-all"
                        style={{ width: `${pct * 100}%` }} />
                    </div>
                  </div>

                  {/* Status control */}
                  <div className="mt-3">
                    <select
                      value={status}
                      onChange={e => handleStatusChange(room, e.target.value as RoomStatus)}
                      className="w-full rounded-lg border border-gray-muted bg-offwhite px-2.5 py-1.5 text-xs font-medium text-slate focus:outline-none focus:ring-1 focus:ring-teal/40"
                    >
                      {Object.keys(STATUS_META).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex justify-end">
                    {deleteConfirm === room.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-coral">Delete room?</span>
                        <button onClick={() => handleDelete(room.id)}
                          className="rounded px-2 py-1 text-xs font-semibold text-coral hover:bg-coral/10">Yes</button>
                        <button onClick={() => setDeleteConfirm(null)}
                          className="rounded px-2 py-1 text-xs text-slate hover:bg-offwhite">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(room.id)}
                        className="rounded px-2 py-1 text-xs text-slate/40 hover:text-coral">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Share tip */}
        {rooms.length > 0 && (
          <div className="mt-6 rounded-xl border border-teal/20 bg-teal/5 px-4 py-3">
            <p className="text-sm text-teal">
              <span className="font-semibold">Rooms are live.</span>{" "}
              Patients can now select a room when they join with your facility code. Use the code badge in the top right to share.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
