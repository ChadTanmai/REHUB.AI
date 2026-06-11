"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import StaffDashboard from "@/components/StaffDashboard";
import type { FacilityWorkspace } from "@/lib/types";
import { getStore } from "@/lib/store";
import { DEMO_FACILITY } from "@/lib/mockData";
import {
  clearTherapistSession,
  getTherapistSession,
} from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";

export default function TherapistPage() {
  const mounted = useMounted();
  const router = useRouter();
  useStoreVersion();

  if (!mounted) {
    return (
      <>
        <SiteNav />
        <main className="flex-1" />
        <SiteFooter />
      </>
    );
  }

  const session = getTherapistSession();
  const store = getStore();

  // Allow a frictionless demo: if unpaired, fall back to the demo facility.
  const facilityId = session?.facilityId ?? DEMO_FACILITY.id;
  const therapistName = session?.name ?? "Care Team";
  const full = store.getWorkspace(facilityId);

  // Filter to assigned rooms when the therapist isn't covering "all".
  const assigned = session?.assignedRooms ?? "all";
  const workspace: FacilityWorkspace =
    assigned === "all"
      ? full
      : {
          ...full,
          rooms: full.rooms.filter((r) => assigned.includes(r.id)),
          requests: full.requests.filter((r) => assigned.includes(r.roomId)),
        };

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-navy">Therapist Dashboard</h1>
              <p className="mt-1 text-slate">
                {full.facility.name} ·{" "}
                <span className="font-medium text-teal">
                  Connected to facility network
                </span>
              </p>
              <p className="mt-0.5 text-sm text-slate/70">
                Signed in as {therapistName}
                {session ? ` · ${session.role}` : " (demo)"}
              </p>
            </div>
            <div className="flex gap-2">
              {!session && (
                <Link
                  href="/setup/therapist"
                  className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a8d8d]"
                >
                  Pair this device
                </Link>
              )}
              {session && (
                <button
                  type="button"
                  onClick={() => {
                    clearTherapistSession();
                    router.refresh();
                    location.reload();
                  }}
                  className="rounded-lg border border-gray-muted bg-white px-4 py-2 text-sm font-medium text-slate hover:bg-offwhite"
                >
                  Sign out
                </button>
              )}
            </div>
          </header>

          <div className="mt-6">
            <StaffDashboard
              workspace={workspace}
              facilityId={facilityId}
              therapistName={therapistName}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
