"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RehubWordmark } from "@/components/RehubLogo";
import { lookupFacilityByCode, type FacilityLookupResult } from "@/lib/supabase/joinLookup";
import { getStore } from "@/lib/store";
import { saveTherapistSession, saveRoomSession } from "@/lib/session";
import { normalizeFacilityCode } from "@/lib/security";
import { useMounted } from "@/lib/useRehub";

type JoinRole = "patient" | "nurse";

function JoinFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const mounted = useMounted();

  const urlCode = normalizeFacilityCode(params.get("code") ?? "");
  const urlRole = (params.get("role") ?? "") as JoinRole | "";

  const [inputCode, setInputCode] = useState(urlCode);
  const [role, setRole] = useState<JoinRole>(urlRole === "nurse" ? "nurse" : "patient");
  const [status, setStatus] = useState<"entry" | "loading" | "ready" | "error">(
    urlCode ? "loading" : "entry",
  );
  const [facility, setFacility] = useState<FacilityLookupResult | null>(null);
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  // Auto-lookup when URL provides a code
  useEffect(() => {
    if (!mounted || !urlCode) return;
    doLookup(urlCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, urlCode]);

  async function doLookup(code: string) {
    setStatus("loading");
    setJoinError("");
    const result = await lookupFacilityByCode(code);
    if (result) {
      setFacility(result);
      setStatus("ready");
    } else {
      setJoinError("That code doesn't match any facility. Check with your administrator.");
      setStatus("entry");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeFacilityCode(inputCode);
    if (!code) { setJoinError("Enter a facility code."); return; }
    doLookup(code);
  }

  function join() {
    if (!facility) return;
    setJoining(true);
    setJoinError("");

    const store = getStore();
    const facilityId = store.facilityIdForCode(facility.facilityCode);
    if (!facilityId) { setJoinError("Could not connect. Try again."); setJoining(false); return; }
    const ws = store.getWorkspace(facilityId);

    if (role === "patient") {
      const room = ws.rooms[0];
      if (!room) {
        setJoinError("No rooms are set up yet. Ask your administrator to add rooms first.");
        setJoining(false);
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
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/"><RehubWordmark /></Link>
        </div>

        <div className="rounded-2xl border border-gray-muted bg-white p-8 shadow-panel">

          {/* Code entry */}
          {status === "entry" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-teal">Join a facility</p>
                <h1 className="mt-1 text-xl font-bold text-navy">Enter your facility code</h1>
                <p className="mt-0.5 text-sm text-slate/60">
                  Your administrator or nurse will have this code.
                </p>
              </div>

              <input
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="e.g. MAPLE-01"
                className="input text-center font-mono text-xl tracking-widest"
                autoFocus
                autoComplete="off"
              />

              <div>
                <p className="mb-2 text-sm font-medium text-slate">I am joining as:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRole("patient")}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${role === "patient" ? "border-teal bg-teal text-white" : "border-gray-muted bg-offwhite text-slate hover:border-teal/40"}`}>
                    Patient
                  </button>
                  <button type="button" onClick={() => setRole("nurse")}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${role === "nurse" ? "border-navy bg-navy text-white" : "border-gray-muted bg-offwhite text-slate hover:border-navy/30"}`}>
                    Care team
                  </button>
                </div>
              </div>

              {joinError && (
                <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{joinError}</p>
              )}

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

          {/* Looking up */}
          {status === "loading" && (
            <div className="py-8 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-teal border-t-transparent" />
              <p className="mt-4 font-semibold text-navy">Connecting…</p>
              <p className="mt-1 text-sm text-slate/60">Looking up your facility</p>
            </div>
          )}

          {/* Ready to join */}
          {status === "ready" && facility && (
            <div className="space-y-5">
              <div className="rounded-xl border border-teal/30 bg-teal/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-teal">Facility found</p>
                <p className="mt-1 text-lg font-bold text-navy">{facility.facilityName}</p>
                {facility.teamName && <p className="text-sm text-slate/60">{facility.teamName}</p>}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate">I am joining as:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRole("patient")}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${role === "patient" ? "border-teal bg-teal text-white" : "border-gray-muted bg-offwhite text-slate"}`}>
                    Patient
                  </button>
                  <button type="button" onClick={() => setRole("nurse")}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${role === "nurse" ? "border-navy bg-navy text-white" : "border-gray-muted bg-offwhite text-slate"}`}>
                    Care team
                  </button>
                </div>
              </div>

              {joinError && (
                <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">{joinError}</p>
              )}

              <button onClick={join} disabled={joining}
                className="w-full rounded-xl bg-navy py-3.5 font-semibold text-white hover:bg-[#0c2030] disabled:opacity-50">
                {joining ? "Joining…" : role === "patient" ? "Open room screen" : "Open dashboard"}
              </button>

              <button onClick={() => { setStatus("entry"); setFacility(null); }}
                className="w-full rounded-xl border border-gray-muted py-2 text-sm font-medium text-slate hover:bg-offwhite">
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
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    }>
      <JoinFlow />
    </Suspense>
  );
}
