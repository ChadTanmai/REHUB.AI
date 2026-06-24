"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RehubWordmark } from "@/components/RehubLogo";
import { lookupFacilityByCode, type FacilityLookupResult } from "@/lib/supabase/joinLookup";
import { getStore } from "@/lib/store";
import { savePatientSession, saveTherapistSession } from "@/lib/session";
import { normalizeFacilityCode, sanitizeField, formatJoinCodeInput } from "@/lib/security";
import { useMounted } from "@/lib/useRehub";
import type { Room, RoomStatus } from "@/lib/types";

type Step = "code" | "lookup" | "rooms" | "name" | "loading" | "error";
type JoinRole = "patient" | "nurse";

const LOADING_MESSAGES = [
  "Connecting to facility…",
  "Verifying room assignment…",
  "Loading care team…",
  "Preparing communication services…",
  "Ready",
];

const AVAILABLE_STATUSES = new Set<RoomStatus>(["Available", "Partially Occupied"]);

function isRoomJoinable(room: Room): boolean {
  if (!room.active) return false;
  const status = room.roomStatus ?? "Available";
  if (!AVAILABLE_STATUSES.has(status)) return false;
  const count = room.patientCount ?? 0;
  const cap = room.capacity ?? 1;
  return count < cap;
}

function RoomCard({
  room,
  selected,
  onSelect,
}: {
  room: Room;
  selected: boolean;
  onSelect: () => void;
}) {
  const joinable = isRoomJoinable(room);
  const status = room.roomStatus ?? "Available";
  const statusColor = joinable ? "text-success" : "text-coral";
  const statusDot = joinable ? "bg-success" : "bg-coral";

  return (
    <button
      type="button"
      disabled={!joinable}
      onClick={onSelect}
      className={`relative flex w-full flex-col rounded-2xl border-2 p-5 text-left transition-all ${
        selected
          ? "border-teal bg-teal/5 shadow-panel"
          : joinable
          ? "border-gray-muted bg-white hover:border-teal/40 hover:shadow-soft"
          : "border-gray-muted bg-offwhite opacity-50"
      }`}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-teal text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      <p className="text-xl font-bold text-navy">{room.name ?? `Room ${room.roomNumber}`}</p>
      {room.floor || room.wing ? (
        <p className="mt-0.5 text-sm text-slate/50">
          {[room.floor && `Floor ${room.floor}`, room.wing && `${room.wing} wing`].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <div className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${statusColor}`}>
        <span className={`h-2 w-2 rounded-full ${statusDot}`} />
        {joinable ? status : status}
      </div>
      {joinable && (room.capacity ?? 1) > 1 && (
        <p className="mt-1 text-xs text-slate/40">
          {(room.capacity ?? 1) - (room.patientCount ?? 0)} slot{((room.capacity ?? 1) - (room.patientCount ?? 0)) !== 1 ? "s" : ""} open
        </p>
      )}
    </button>
  );
}

function LoadingSequence({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (idx >= LOADING_MESSAGES.length - 1) {
      const t = setTimeout(onDone, 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setIdx(i => i + 1), 500);
    return () => clearTimeout(t);
  }, [idx, onDone]);

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      <div className="space-y-1.5">
        {LOADING_MESSAGES.map((msg, i) => (
          <p
            key={msg}
            className={`text-sm transition-all duration-300 ${
              i < idx ? "text-success" : i === idx ? "font-semibold text-navy" : "text-slate/30"
            }`}
          >
            {i < idx ? "✓ " : ""}{msg}
          </p>
        ))}
      </div>
    </div>
  );
}

function JoinFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const mounted = useMounted();

  const urlCode = normalizeFacilityCode(params.get("code") ?? "");

  const [step, setStep] = useState<Step>(urlCode ? "lookup" : "code");
  const [inputCode, setInputCode] = useState(urlCode);
  const [role, setRole] = useState<JoinRole>("patient");
  const [facility, setFacility] = useState<FacilityLookupResult | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [patientName, setPatientName] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!mounted || !urlCode) return;
    doLookup(urlCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, urlCode]);

  async function doLookup(code: string) {
    setStep("lookup");
    setError("");
    const result = await lookupFacilityByCode(code);
    if (result) {
      setFacility(result);
      setStep("rooms");
    } else {
      setError("That code doesn't match any facility. Check with your administrator.");
      setStep("code");
    }
  }

  function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeFacilityCode(inputCode);
    if (!code) { setError("Enter a facility code."); return; }
    doLookup(code);
  }

  function handleRoomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (role === "nurse") {
      // Staff — skip room/name, go straight to therapist dashboard
      handleJoinStaff();
      return;
    }
    if (!selectedRoom) { setError("Select a room to continue."); return; }
    setStep("name");
    setError("");
  }

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = sanitizeField(patientName.trim(), 60);
    if (!name) { setError("Enter your name to continue."); return; }
    setStep("loading");
  }

  function handleJoinStaff() {
    if (!facility) return;
    setJoining(true);
    const store = getStore();
    const facilityId = store.facilityIdForCode(facility.facilityCode);
    if (!facilityId) { setError("Could not connect. Try again."); setJoining(false); return; }
    const ws = store.getWorkspace(facilityId);
    const therapist = store.addTherapist(facilityId, {
      name: "Care Team Member",
      role: "Nurse",
      assignedRooms: "all",
    });
    saveTherapistSession({
      deviceType: "therapist",
      facilityId,
      facilityCode: ws.facility.facilityCode,
      therapistId: therapist.id,
      name: therapist.name,
      role: therapist.role,
      assignedRooms: "all",
      pairedAt: new Date().toISOString(),
    });
    router.push("/therapist");
  }

  function handleLoadingDone() {
    if (!facility || !selectedRoom) return;
    const store = getStore();
    const facilityId = store.facilityIdForCode(facility.facilityCode);
    if (!facilityId) { setStep("error"); return; }
    const name = sanitizeField(patientName.trim(), 60);
    store.assignPatientToRoom(facilityId, selectedRoom.id, name);
    savePatientSession({
      deviceType: "patient",
      facilityId,
      facilityCode: facility.facilityCode,
      facilityName: facility.facilityName,
      roomId: selectedRoom.id,
      roomNumber: selectedRoom.roomNumber,
      patientName: name,
      joinedAt: new Date().toISOString(),
    });
    router.push("/patient");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const rooms = (() => {
    if (!facility) return [];
    const store = getStore();
    const facilityId = store.facilityIdForCode(facility.facilityCode);
    if (!facilityId) return [];
    return store.getWorkspace(facilityId).rooms.filter(r => r.active !== false);
  })();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-offwhite px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <Link href="/"><RehubWordmark /></Link>
        </div>

        <div className="rounded-2xl border border-gray-muted bg-white shadow-panel overflow-hidden">

          {/* ── Step: Enter code ── */}
          {step === "code" && (
            <form onSubmit={handleCodeSubmit} className="p-8 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-teal">Join a facility</p>
                <h1 className="mt-1 text-xl font-bold text-navy">Enter your facility code</h1>
                <p className="mt-0.5 text-sm text-slate/60">Your administrator or nurse will have this code.</p>
              </div>

              <input
                value={inputCode}
                onChange={e => setInputCode(formatJoinCodeInput(e.target.value))}
                placeholder="TEST-01"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="input text-center font-mono text-2xl tracking-widest uppercase"
                autoFocus autoComplete="off"
              />
              <p className="-mt-2 text-center text-xs text-slate/40">
                Type the name then the number — the dash adds itself.
              </p>

              <div>
                <p className="mb-2 text-sm font-medium text-slate">I am joining as:</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["patient", "nurse"] as JoinRole[]).map(r => (
                    <button key={r} type="button" onClick={() => setRole(r)}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors capitalize ${
                        role === r
                          ? r === "patient" ? "border-teal bg-teal text-white" : "border-navy bg-navy text-white"
                          : "border-gray-muted bg-offwhite text-slate hover:border-teal/30"
                      }`}>
                      {r === "patient" ? "Patient" : "Care team"}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

              <button type="submit" disabled={!inputCode.trim()}
                className="w-full rounded-xl bg-navy py-3.5 font-semibold text-white hover:bg-[#0c2030] disabled:opacity-40">
                Continue
              </button>

              <p className="text-center text-xs text-slate/50">
                Staff with an account?{" "}
                <Link href="/auth/signin" className="font-medium text-teal hover:underline">Sign in instead</Link>
              </p>
            </form>
          )}

          {/* ── Step: Looking up ── */}
          {step === "lookup" && (
            <div className="p-8 py-16 text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-teal border-t-transparent" />
              <p className="mt-5 font-semibold text-navy">Finding your facility…</p>
            </div>
          )}

          {/* ── Step: Room selection ── */}
          {step === "rooms" && facility && (
            <form onSubmit={handleRoomSubmit}>
              {/* Facility header */}
              <div className="border-b border-gray-muted px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-teal">Connected</p>
                    <p className="mt-0.5 text-lg font-bold text-navy">{facility.facilityName}</p>
                    {facility.teamName && <p className="text-sm text-slate/60">{facility.teamName}</p>}
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Active
                  </span>
                </div>

                {/* Role toggle */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["patient", "nurse"] as JoinRole[]).map(r => (
                    <button key={r} type="button" onClick={() => { setRole(r); setSelectedRoom(null); setError(""); }}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        role === r
                          ? r === "patient" ? "border-teal bg-teal text-white" : "border-navy bg-navy text-white"
                          : "border-gray-muted bg-offwhite text-slate"
                      }`}>
                      {r === "patient" ? "Patient" : "Care team"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {role === "nurse" ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate/70">You&apos;ll join as a care team member with access to the staff dashboard.</p>
                    <button type="submit"
                      className="w-full rounded-xl bg-navy py-3.5 font-semibold text-white hover:bg-[#0c2030]">
                      Open staff dashboard
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="mb-3 font-semibold text-navy">Select your room</p>

                    {rooms.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                        <p className="font-semibold text-amber-800">No rooms available</p>
                        <p className="mt-1 text-sm text-amber-700">
                          Your administrator hasn&apos;t set up any rooms yet. Please contact the facility.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {rooms.map(room => (
                          <RoomCard key={room.id} room={room}
                            selected={selectedRoom?.id === room.id}
                            onSelect={() => { setSelectedRoom(room); setError(""); }} />
                        ))}
                      </div>
                    )}

                    {error && <p className="mt-3 rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

                    {rooms.length > 0 && (
                      <button type="submit" disabled={!selectedRoom}
                        className="mt-4 w-full rounded-xl bg-teal py-3.5 font-semibold text-white hover:bg-[#2a8d8d] disabled:opacity-40">
                        Continue to {selectedRoom ? `Room ${selectedRoom.roomNumber}` : "room"}
                      </button>
                    )}
                  </>
                )}

                <button type="button" onClick={() => { setFacility(null); setSelectedRoom(null); setStep("code"); setError(""); }}
                  className="mt-2 w-full rounded-xl border border-gray-muted py-2 text-sm font-medium text-slate hover:bg-offwhite">
                  Use a different code
                </button>
              </div>
            </form>
          )}

          {/* ── Step: Patient name ── */}
          {step === "name" && (
            <form onSubmit={handleNameSubmit} className="p-8 space-y-5">
              <div>
                <button type="button" onClick={() => setStep("rooms")}
                  className="mb-3 flex items-center gap-1.5 text-sm text-slate/60 hover:text-navy">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Back
                </button>
                <div className="rounded-xl bg-teal/5 border border-teal/20 px-4 py-3 mb-2">
                  <p className="text-sm font-semibold text-navy">{selectedRoom?.name ?? `Room ${selectedRoom?.roomNumber}`}</p>
                  <p className="text-xs text-slate/60">{facility?.facilityName}</p>
                </div>
                <h2 className="text-lg font-bold text-navy">What&apos;s your name?</h2>
                <p className="mt-0.5 text-sm text-slate/60">So your care team knows who to help.</p>
              </div>

              <input
                value={patientName}
                onChange={e => setPatientName(e.target.value)}
                placeholder="First name or full name"
                className="input text-lg"
                autoFocus autoComplete="name"
              />

              {error && <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

              <button type="submit" disabled={!patientName.trim()}
                className="w-full rounded-xl bg-teal py-3.5 font-semibold text-white hover:bg-[#2a8d8d] disabled:opacity-40">
                Join facility
              </button>
            </form>
          )}

          {/* ── Step: Loading ── */}
          {step === "loading" && (
            <div className="p-8">
              <LoadingSequence onDone={handleLoadingDone} />
            </div>
          )}

          {/* ── Step: Error ── */}
          {step === "error" && (
            <div className="p-8 text-center space-y-4">
              <p className="text-lg font-bold text-navy">Something went wrong</p>
              <p className="text-sm text-slate/60">Please try again or contact your administrator.</p>
              <button onClick={() => setStep("code")}
                className="rounded-xl bg-navy px-6 py-3 font-semibold text-white hover:bg-[#0c2030]">
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-offwhite">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    }>
      <JoinFlow />
    </Suspense>
  );
}
