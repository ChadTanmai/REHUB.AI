"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RehubWordmark } from "@/components/RehubLogo";
import { getStore } from "@/lib/store";
import { saveRoomSession, saveTherapistSession } from "@/lib/session";
import type { Room } from "@/lib/types";

type Mode = "choose" | "start" | "join-patient" | "join-nurse";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `DEMO-${s}`;
}

export default function DemoPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [createdId, setCreatedId] = useState("");

  function openRoom(facilityId: string, facilityCode: string, room: Room) {
    saveRoomSession({
      deviceType: "room",
      facilityId,
      facilityCode,
      roomId: room.id,
      roomNumber: room.roomNumber,
      displayName: room.displayName,
      pairedAt: new Date().toISOString(),
    });
    router.push(`/room/${room.id}`);
  }

  function openDashboard(facilityId: string, facilityCode: string) {
    saveTherapistSession({
      deviceType: "therapist",
      facilityId,
      facilityCode,
      therapistId: "demo-nurse",
      name: "Care Team",
      role: "Nurse",
      assignedRooms: "all",
      pairedAt: new Date().toISOString(),
    });
    router.push("/therapist");
  }

  function handleStart() {
    const store = getStore();
    const facilityCode = randomCode();
    const facility = store.createFacility({
      name: "Demo Facility",
      facilityCode,
      roomCount: 1,
      teamName: "Care Team",
    });
    store.addRoom(facility.id, { roomNumber: "101", displayName: "Room 101" });
    setCreatedCode(facilityCode);
    setCreatedId(facility.id);
    setMode("start");
  }

  function resolveOrError(): string | null {
    const facilityId = getStore().facilityIdForCode(code);
    if (!facilityId) {
      setError("That code doesn't match any facility. Check and try again.");
      return null;
    }
    return facilityId;
  }

  function handleJoinPatient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const facilityId = resolveOrError();
    if (!facilityId) return;
    const store = getStore();
    const ws = store.getWorkspace(facilityId);
    const room = ws.rooms[0] ?? store.addRoom(facilityId, { roomNumber: "101", displayName: "Room 101" });
    openRoom(facilityId, ws.facility.facilityCode, room);
  }

  function handleJoinNurse(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const facilityId = resolveOrError();
    if (!facilityId) return;
    const ws = getStore().getWorkspace(facilityId);
    openDashboard(facilityId, ws.facility.facilityCode);
  }

  return (
    <main className="flex min-h-screen flex-col bg-offwhite">
      <header className="border-b border-gray-muted bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/"><RehubWordmark /></Link>
          {mode !== "choose" && (
            <button
              onClick={() => { setMode("choose"); setError(""); setCode(""); }}
              className="text-sm font-medium text-slate hover:text-navy"
            >
              ← Back
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-12">
        {mode === "choose" && (
          <div>
            <h1 className="text-center text-2xl font-bold text-navy">Try the live demo</h1>
            <p className="mt-2 text-center text-sm text-slate">
              Set up a demo facility, then connect a patient room and a care team
              device — they sync in real time.
            </p>

            <div className="mt-8 space-y-3">
              <button
                onClick={handleStart}
                className="flex w-full items-center justify-between rounded-xl border border-navy bg-navy px-5 py-4 text-left text-white transition hover:bg-[#0c2030]"
              >
                <span>
                  <span className="block font-semibold">Start a facility</span>
                  <span className="block text-sm text-white/70">Create a demo facility and get a join code</span>
                </span>
                <span aria-hidden>→</span>
              </button>

              <button
                onClick={() => { setMode("join-patient"); setError(""); }}
                className="flex w-full items-center justify-between rounded-xl border border-gray-muted bg-white px-5 py-4 text-left transition hover:border-navy/40"
              >
                <span>
                  <span className="block font-semibold text-navy">Join as patient</span>
                  <span className="block text-sm text-slate">Open the room screen with a join code</span>
                </span>
                <span aria-hidden className="text-slate">→</span>
              </button>

              <button
                onClick={() => { setMode("join-nurse"); setError(""); }}
                className="flex w-full items-center justify-between rounded-xl border border-gray-muted bg-white px-5 py-4 text-left transition hover:border-navy/40"
              >
                <span>
                  <span className="block font-semibold text-navy">Join as care team</span>
                  <span className="block text-sm text-slate">Open the dashboard with a join code</span>
                </span>
                <span aria-hidden className="text-slate">→</span>
              </button>
            </div>
          </div>
        )}

        {mode === "start" && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-navy">Facility ready</h1>
            <p className="mt-2 text-sm text-slate">
              Share this join code with a patient room and a care team device.
            </p>

            <div className="mt-6 rounded-xl border border-gray-muted bg-white px-6 py-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate">Join code</p>
              <p className="mt-1 text-3xl font-bold tracking-widest text-navy">{createdCode}</p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => {
                  const room = getStore().getWorkspace(createdId).rooms[0];
                  openRoom(createdId, createdCode, room);
                }}
                className="rounded-xl border border-navy bg-navy px-5 py-3 font-semibold text-white hover:bg-[#0c2030]"
              >
                Open patient room
              </button>
              <button
                onClick={() => openDashboard(createdId, createdCode)}
                className="rounded-xl border border-gray-muted bg-white px-5 py-3 font-semibold text-navy hover:border-navy/40"
              >
                Open dashboard
              </button>
            </div>
            <p className="mt-4 text-xs text-slate">
              Tip: open the dashboard on one device and the room on another to see
              requests sync live.
            </p>
          </div>
        )}

        {(mode === "join-patient" || mode === "join-nurse") && (
          <form onSubmit={mode === "join-patient" ? handleJoinPatient : handleJoinNurse}>
            <h1 className="text-center text-2xl font-bold text-navy">
              {mode === "join-patient" ? "Join as patient" : "Join as care team"}
            </h1>
            <p className="mt-2 text-center text-sm text-slate">
              Enter the join code from your facility.
            </p>

            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DEMO-XXXX"
              autoFocus
              className="mt-6 w-full rounded-xl border border-gray-muted bg-white px-4 py-3 text-center text-lg font-semibold tracking-widest text-navy outline-none focus:border-navy"
            />

            {error && <p className="mt-3 text-center text-sm text-coral">{error}</p>}

            <button
              type="submit"
              className="mt-5 w-full rounded-xl border border-navy bg-navy px-5 py-3 font-semibold text-white hover:bg-[#0c2030]"
            >
              Connect
            </button>

            <p className="mt-4 text-center text-xs text-slate">
              Don&apos;t have a code?{" "}
              <button
                type="button"
                onClick={() => { setMode("choose"); setError(""); }}
                className="font-medium text-navy underline"
              >
                Start a facility
              </button>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
