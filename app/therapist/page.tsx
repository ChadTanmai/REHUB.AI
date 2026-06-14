"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteNav";
import StaffDashboard from "@/components/StaffDashboard";
import type { FacilityWorkspace } from "@/lib/types";
import { getStore } from "@/lib/store";
import { DEMO_FACILITY } from "@/lib/mockData";
import { clearTherapistSession, getTherapistSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";

export default function TherapistPage() {
  const mounted = useMounted();
  const router = useRouter();
  useStoreVersion();

  if (!mounted) {
    return (
      <>
        <AppNav />
        <main className="flex-1" />
      </>
    );
  }

  const session = getTherapistSession();
  const store = getStore();

  const facilityId = session?.facilityId ?? DEMO_FACILITY.id;
  const therapistName = session?.name ?? "Care Team";
  const full = store.getWorkspace(facilityId);

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
      <AppNav
        facilityName={full.facility.name}
        userName={therapistName}
      />
      <main className="flex-1 bg-offwhite">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

          {/* Page header */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-muted bg-white p-4 shadow-soft sm:p-5">
            <div>
              <h1 className="text-xl font-bold text-navy">Therapist Dashboard</h1>
              <p className="mt-0.5 text-sm text-slate/70">
                {full.facility.name}
                {session ? ` · ${therapistName} · ${session.role}` : " · Demo mode"}
                {" · "}
                <span className="font-medium text-teal">● Live</span>
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
          </div>

          <StaffDashboard
            workspace={workspace}
            facilityId={facilityId}
            therapistName={therapistName}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
