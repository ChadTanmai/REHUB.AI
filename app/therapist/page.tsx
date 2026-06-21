"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AppNav from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteNav";
import StaffDashboard from "@/components/StaffDashboard";
import EmptyState from "@/components/EmptyState";
import { getStore } from "@/lib/store";
import { getTherapistSession } from "@/lib/session";
import { useMounted, useWorkspace, useStoreVersion } from "@/lib/useRehub";

function PeopleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

export default function TherapistPage() {
  const mounted = useMounted();
  const router = useRouter();
  useStoreVersion();

  useEffect(() => {
    if (mounted) {
      const session = getTherapistSession();
      if (!session) router.replace("/dashboard");
    }
  }, [mounted, router]);

  if (!mounted) {
    return (
      <>
        <AppNav />
        <main className="flex-1 bg-offwhite" />
      </>
    );
  }

  const session = getTherapistSession();
  if (!session) return null;

  const store = getStore();
  const full = store.getWorkspace(session.facilityId);
  const assigned = session.assignedRooms;
  const workspace =
    assigned === "all"
      ? full
      : {
          ...full,
          rooms: full.rooms.filter((r) => assigned.includes(r.id)),
          requests: full.requests.filter((r) => assigned.includes(r.roomId)),
        };

  return (
    <>
      <AppNav facilityName={full.facility.name} userName={session.name} />
      <main className="flex-1 bg-offwhite">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-muted bg-white p-4 shadow-soft sm:p-5">
            <div>
              <h1 className="text-xl font-bold text-navy">Dashboard</h1>
              <p className="mt-0.5 text-sm text-slate/70">
                {full.facility.name} · {session.name} · {session.role} ·{" "}
                <span className="font-medium text-teal">● Live</span>
              </p>
            </div>
          </div>

          {workspace.rooms.length === 0 ? (
            <EmptyState
              icon={<PeopleIcon />}
              title="No rooms connected yet"
              description="Share the patient room join link with room devices to start receiving care requests."
              action={{ label: "Go to facility setup", href: "/facility" }}
            />
          ) : (
            <StaffDashboard
              workspace={workspace}
              facilityId={session.facilityId}
              therapistName={session.name}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
