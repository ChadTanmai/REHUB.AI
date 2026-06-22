"use client";

/**
 * /join?code=XXXX&role=nurse  (or patient)
 *
 * Therapists and nurses click an invite link from the facility director.
 * If not signed in → redirected to signup with intent preserved.
 * If signed in → automatically joins the facility and goes to dashboard.
 */

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RehubWordmark } from "@/components/RehubLogo";
import { getStore } from "@/lib/store";
import { saveTherapistSession, saveRoomSession } from "@/lib/session";
import { getAuthClient } from "@/lib/auth/supabase-browser";

function JoinFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const code = (params.get("code") ?? "").toUpperCase();
  const role = params.get("role") ?? "nurse"; // "nurse" | "patient"

  const [status, setStatus] = useState<"checking" | "ready" | "error">("checking");
  const [facilityName, setFacilityName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) { setError("Missing join code."); setStatus("error"); return; }
    const store = getStore();
    const facilityId = store.facilityIdForCode(code);
    if (!facilityId) { setError("This join code doesn't match any facility. It may have expired or been typed incorrectly."); setStatus("error"); return; }
    const ws = store.getWorkspace(facilityId);
    setFacilityName(ws.facility.name);
    setStatus("ready");
  }, [code]);

  function join() {
    const store = getStore();
    const facilityId = store.facilityIdForCode(code);
    if (!facilityId) return;
    const ws = store.getWorkspace(facilityId);

    if (role === "patient") {
      const room = ws.rooms[0];
      if (!room) { setError("No rooms have been set up yet. Ask the facility director to add rooms first."); return; }
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
          {status === "checking" && (
            <div className="py-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
              <p className="mt-3 text-sm text-slate">Verifying join code…</p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <p className="text-sm font-medium text-coral">{error}</p>
              <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-teal hover:underline">
                Go to dashboard
              </Link>
            </div>
          )}

          {status === "ready" && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">
                You&apos;re invited
              </p>
              <h1 className="mt-2 text-xl font-bold text-navy">{facilityName}</h1>
              <p className="mt-1 text-sm text-slate">
                Join as{" "}
                <strong>{role === "patient" ? "a patient room" : "care team member"}</strong>
                {" "}with code{" "}
                <span className="font-mono font-bold text-navy">{code}</span>.
              </p>

              <button
                onClick={join}
                className="mt-6 w-full rounded-xl bg-navy py-3 font-semibold text-white hover:bg-[#0c2030]"
              >
                {role === "patient" ? "Open room screen" : "Open dashboard"}
              </button>

              <p className="mt-4 text-center text-xs text-slate/60">
                Wrong facility?{" "}
                <Link href="/dashboard" className="font-medium text-navy hover:underline">
                  Go to dashboard
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-offwhite"><div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" /></div>}>
      <JoinFlow />
    </Suspense>
  );
}
