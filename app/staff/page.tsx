"use client";

import { SiteNav, SiteFooter } from "@/components/SiteNav";
import StaffDashboard from "@/components/StaffDashboard";
import { DEMO_FACILITY } from "@/lib/mockData";
import { useMounted, useWorkspace } from "@/lib/useRehub";

export default function StaffPage() {
  const mounted = useMounted();
  const workspace = useWorkspace(DEMO_FACILITY.id);

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <header>
            <h1 className="text-2xl font-bold text-navy">Staff Dashboard</h1>
            <p className="mt-1 text-slate">
              Live resident requests, sorted by urgency and time waiting.
            </p>
          </header>

          <div className="mt-6">
            {mounted ? (
              <StaffDashboard
                workspace={workspace}
                facilityId={DEMO_FACILITY.id}
                therapistName="Care Team"
              />
            ) : (
              <div className="h-96 animate-pulse rounded-xl border border-gray-muted bg-white" />
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
