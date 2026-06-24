"use client";

/**
 * /join/MAPLE-01  — clean join URL, same as /join?code=MAPLE-01
 *
 * This is what QR codes, invite links, and share buttons point to.
 * Auto-looks up the facility and shows the join flow instantly.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { RehubWordmark } from "@/components/RehubLogo";
import { lookupFacilityByCode, type FacilityLookupResult } from "@/lib/supabase/joinLookup";
import { getStore } from "@/lib/store";
import { saveTherapistSession, saveRoomSession } from "@/lib/session";
import { normalizeFacilityCode } from "@/lib/security";
import { useMounted } from "@/lib/useRehub";

type JoinRole = "patient" | "nurse";

export default function JoinCodePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const mounted = useMounted();

  const rawCode = normalizeFacilityCode(decodeURIComponent(params.code ?? ""));

  const [status, setStatus] = useState<"loading" | "ready" | "not-found">("loading");
  const [facility, setFacility] = useState<FacilityLookupResult | null>(null);
  const [role, setRole] = useState<JoinRole>("patient");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mounted || !rawCode) { setStatus("not-found"); return; }

    lookupFacilityByCode(rawCode).then((result) => {
      if (result) {
        setFacility(result);
        setStatus("ready");
      } else {
        setStatus("not-found");
      }
    });
  }, [mounted, rawCode]);

  function join() {
    if (!facility) return;
    setJoining(true);
    setError("");

    const store = getStore();
    const facilityId = store.facilityIdForCode(facility.facilityCode);
    if (!facilityId) { setError("Could not connect. Please try again."); setJoining(false); return; }
    const ws = store.getWorkspace(facilityId);

    if (role === "patient") {
      const room = ws.rooms[0];
      if (!room) {
        setError("No rooms are set up yet. Ask your administrator to add rooms first.");
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

          {/* Loading */}
          {status === "loading" && (
            <div className="py-8 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-teal border-t-transparent" />
              <p className="mt-4 font-semibold text-navy">Connecting…</p>
              <p className="mt-1 text-sm text-slate/60">Looking up facility <span className="font-mono font-bold">{rawCode}</span></p>
            </div>
          )}

          {/* Not found */}
          {status === "not-found" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-coral/10 text-coral">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                </svg>
              </div>
              <p className="font-semibold text-navy">Facility not found</p>
              <p className="mt-1 text-sm text-slate/60">
                The code <span className="font-mono font-bold">{rawCode}</span> doesn&apos;t match any facility. Check with your administrator.
              </p>
              <Link href="/join" className="mt-4 inline-block text-sm font-medium text-teal hover:underline">
                Try a different code
              </Link>
            </div>
          )}

          {/* Ready to join */}
          {status === "ready" && facility && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-teal">Facility found</p>
                <h1 className="mt-1 text-xl font-bold text-navy">{facility.facilityName}</h1>
                {facility.teamName && (
                  <p className="text-sm text-slate/60">{facility.teamName}</p>
                )}
                <p className="mt-0.5 font-mono text-sm font-medium text-slate/50">{facility.facilityCode}</p>
              </div>

              {/* Role picker */}
              <div>
                <p className="mb-2 text-sm font-medium text-slate">I am joining as:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("patient")}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      role === "patient"
                        ? "border-teal bg-teal text-white"
                        : "border-gray-muted bg-offwhite text-slate hover:border-teal/40"
                    }`}
                  >
                    Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("nurse")}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      role === "nurse"
                        ? "border-navy bg-navy text-white"
                        : "border-gray-muted bg-offwhite text-slate hover:border-navy/30"
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
                onClick={join}
                disabled={joining}
                className="w-full rounded-xl bg-navy py-3.5 font-semibold text-white transition-colors hover:bg-[#0c2030] disabled:opacity-50"
              >
                {joining ? "Joining…" : role === "patient" ? "Open room screen" : "Open dashboard"}
              </button>

              <p className="text-center text-xs text-slate/40">
                Code: <span className="font-mono font-bold">{rawCode}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
