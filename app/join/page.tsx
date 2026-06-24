"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RehubWordmark } from "@/components/RehubLogo";
import { getStore } from "@/lib/store";
import { saveTherapistSession, saveRoomSession } from "@/lib/session";

function JoinFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const urlCode = (params.get("code") ?? "").toUpperCase();
  const urlRole = params.get("role") ?? ""; // pre-selected role from invite link

  // If no code in URL, show the manual entry form first
  const [inputCode, setInputCode] = useState(urlCode);
  const [selectedRole, setSelectedRole] = useState<"patient" | "nurse">(
    urlRole === "nurse" ? "nurse" : "patient",
  );
  const [status, setStatus] = useState<"entry" | "checking" | "ready" | "error">(
    urlCode ? "checking" : "entry",
  );
  const [facilityName, setFacilityName] = useState("");
  const [resolvedCode, setResolvedCode] = useState(urlCode);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!urlCode) return; // waiting for manual entry
    checkCode(urlCode, urlRole === "nurse" ? "nurse" : "patient");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode]);

  function checkCode(code: string, role: "patient" | "nurse") {
    setStatus("checking");
    setError("");
    const store = getStore();
    const facilityId = store.facilityIdForCode(code.trim().toUpperCase());
    if (!facilityId) {
      setError("That code doesn't match any facility. Check the code and try again.");
      setStatus("entry");
      return;
    }
    const ws = store.getWorkspace(facilityId);
    setFacilityName(ws.facility.name);
    setResolvedCode(code.trim().toUpperCase());
    setSelectedRole(role);
    setStatus("ready");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputCode.trim()) { setError("Enter a facility code."); return; }
    checkCode(inputCode, selectedRole);
  }

  function join() {
    const store = getStore();
    const facilityId = store.facilityIdForCode(resolvedCode);
    if (!facilityId) return;
    const ws = store.getWorkspace(facilityId);

    if (selectedRole === "patient") {
      const room = ws.rooms[0];
      if (!room) {
        setError("No rooms have been set up yet. Ask your facility administrator to add rooms first.");
        setStatus("entry");
        return;
      }
      saveRoomSession({
        deviceType: "room",
        facilityId,
        facilityCode: ws.facility.facilityCode,
        roomId: room.id,
        roomNumber: room.roomNumber,
        displayName: room.displayName,
        pairedAt: new Date().toISOString(),
      });
      router.push(`/room/${room.id}`);
    } else {
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
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-offwhite px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/"><RehubWordmark /></Link>
        </div>

        <div className="rounded-2xl border border-gray-muted bg-white p-8 shadow-panel">

          {/* Manual code entry */}
          {status === "entry" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-teal">
                  Join a facility
                </p>
                <h1 className="mt-1 text-xl font-bold text-navy">Enter your facility code</h1>
                <p className="mt-1 text-sm text-slate/70">
                  Your administrator or nurse will have given you this code.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate">Facility code</label>
                <input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MAPLE-01"
                  className="input font-mono text-center tracking-widest text-lg"
                  autoFocus
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate">I am joining as</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole("patient")}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      selectedRole === "patient"
                        ? "border-teal bg-teal/8 text-teal"
                        : "border-gray-muted bg-white text-slate hover:border-teal/40"
                    }`}
                  >
                    Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole("nurse")}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      selectedRole === "nurse"
                        ? "border-navy bg-navy/8 text-navy"
                        : "border-gray-muted bg-white text-slate hover:border-navy/30"
                    }`}
                  >
                    Care team
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>
              )}

              <button
                type="submit"
                disabled={!inputCode.trim()}
                className="w-full rounded-xl bg-navy py-3 font-semibold text-white hover:bg-[#0c2030] disabled:opacity-40"
              >
                Continue
              </button>

              <p className="text-center text-xs text-slate/50">
                Don&apos;t have a code?{" "}
                <Link href="/auth/signin" className="font-medium text-teal hover:underline">
                  Sign in instead
                </Link>
              </p>
            </form>
          )}

          {/* Verifying */}
          {status === "checking" && (
            <div className="py-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
              <p className="mt-3 text-sm text-slate">Verifying code…</p>
            </div>
          )}

          {/* Confirmed — ready to join */}
          {status === "ready" && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">
                Facility found
              </p>
              <h1 className="mt-2 text-xl font-bold text-navy">{facilityName}</h1>
              <p className="mt-1 text-sm text-slate">
                Joining as <strong>{selectedRole === "patient" ? "a patient" : "care team member"}</strong> with code{" "}
                <span className="font-mono font-bold text-navy">{resolvedCode}</span>.
              </p>

              <button
                onClick={join}
                className="mt-6 w-full rounded-xl bg-navy py-3 font-semibold text-white hover:bg-[#0c2030]"
              >
                {selectedRole === "patient" ? "Open room screen" : "Open dashboard"}
              </button>

              <button
                onClick={() => setStatus("entry")}
                className="mt-3 w-full rounded-xl border border-gray-muted py-2.5 text-sm font-medium text-slate hover:bg-offwhite"
              >
                Use a different code
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    }>
      <JoinFlow />
    </Suspense>
  );
}
