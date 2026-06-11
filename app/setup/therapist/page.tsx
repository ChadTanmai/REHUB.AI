"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import type { TherapistRole } from "@/lib/types";
import { getStore } from "@/lib/store";
import { DEMO_FACILITY_CODE } from "@/lib/mockData";
import { normalizeFacilityCode, sanitizeField } from "@/lib/security";
import { saveTherapistSession } from "@/lib/session";
import { useMounted } from "@/lib/useRehub";

const ROLES: TherapistRole[] = [
  "Physical Therapist",
  "Occupational Therapist",
  "Nurse",
  "Caregiver",
  "Aide",
];

export default function TherapistPairingPage() {
  const mounted = useMounted();
  const router = useRouter();
  const [code, setCode] = useState(DEMO_FACILITY_CODE);
  const [name, setName] = useState("");
  const [role, setRole] = useState<TherapistRole>("Physical Therapist");
  const [error, setError] = useState("");

  function pair(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const store = getStore();
    const facilityId = store.facilityIdForCode(normalizeFacilityCode(code));
    if (!facilityId) {
      setError("That facility code wasn't found. Check the code and try again.");
      return;
    }
    const cleanName = sanitizeField(name, 40);
    if (!cleanName) {
      setError("Enter your name.");
      return;
    }
    const therapist = store.addTherapist(facilityId, {
      name: cleanName,
      role,
      assignedRooms: "all",
    });
    const ws = store.getWorkspace(facilityId);
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

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
          <h1 className="text-2xl font-bold text-navy">Therapist Sign In</h1>
          <p className="mt-2 text-slate">
            Join your facility&apos;s shared dashboard. You&apos;ll receive every
            request from your assigned rooms in real time.
          </p>

          <form onSubmit={pair} className="mt-6 space-y-4 rounded-xl border border-gray-muted bg-white p-5">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate">Facility code</span>
              <input
                value={code}
                onChange={(e) => setCode(normalizeFacilityCode(e.target.value))}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate">Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dana Whitfield"
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as TherapistRole)}
                className="input"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-slate/60">
              MVP uses mock pairing — no password required. Production will use
              role-based accounts.
            </p>

            {error && <p className="text-sm font-medium text-coral">{error}</p>}

            <button
              type="submit"
              disabled={!mounted}
              className="w-full rounded-lg bg-teal px-5 py-3 font-semibold text-white hover:bg-[#2a8d8d] disabled:opacity-50"
            >
              Open dashboard
            </button>
          </form>

          <p className="mt-4 text-sm text-slate/70">
            Need a facility code?{" "}
            <Link href="/setup" className="font-medium text-teal underline">
              Set up a facility
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
