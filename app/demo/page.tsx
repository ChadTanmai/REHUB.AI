"use client";

import { useState } from "react";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import ResidentRequestPanel from "@/components/ResidentRequestPanel";
import StaffDashboard from "@/components/StaffDashboard";
import AdminAnalytics from "@/components/AdminAnalytics";
import SafetyNote from "@/components/SafetyNote";
import { getStore } from "@/lib/store";
import { DEMO_FACILITY, DEMO_ROOMS } from "@/lib/mockData";
import { useMounted, useWorkspace } from "@/lib/useRehub";

type Tab = "resident" | "staff" | "admin";

export default function DemoPage() {
  const mounted = useMounted();
  const workspace = useWorkspace(DEMO_FACILITY.id);
  const [tab, setTab] = useState<Tab>("staff");
  const room = DEMO_ROOMS.find((r) => r.roomNumber === "204") ?? DEMO_ROOMS[0];

  function reset() {
    getStore().resetFacility(DEMO_FACILITY.id);
  }

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-navy">Interactive Demo</h1>
              <p className="mt-1 text-slate">
                Submit a request as a resident, then watch it appear live for
                staff. Everything runs locally with fictional data.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-gray-muted bg-white px-4 py-2 text-sm font-medium text-slate hover:bg-offwhite"
            >
              Reset demo data
            </button>
          </div>

          <div className="mt-5 flex gap-1 rounded-lg bg-white p-1 shadow-soft sm:w-fit">
            <Tab id="resident" tab={tab} setTab={setTab}>
              Resident View
            </Tab>
            <Tab id="staff" tab={tab} setTab={setTab}>
              Staff View
            </Tab>
            <Tab id="admin" tab={tab} setTab={setTab}>
              Admin View
            </Tab>
          </div>

          <div className="mt-6">
            {!mounted ? (
              <div className="h-96 animate-pulse rounded-xl border border-gray-muted bg-white" />
            ) : tab === "resident" ? (
              <div className="mx-auto max-w-xl">
                <ResidentRequestPanel facilityId={DEMO_FACILITY.id} roomId={room.id} />
              </div>
            ) : tab === "staff" ? (
              <StaffDashboard
                workspace={workspace}
                facilityId={DEMO_FACILITY.id}
                therapistName="Dana Whitfield"
              />
            ) : (
              <AdminAnalytics requests={workspace.requests} />
            )}
          </div>

          <div className="mt-8">
            <SafetyNote variant="compact" />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Tab({
  id,
  tab,
  setTab,
  children,
}: {
  id: Tab;
  tab: Tab;
  setTab: (t: Tab) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
        tab === id ? "bg-teal text-white" : "text-slate hover:bg-offwhite"
      }`}
    >
      {children}
    </button>
  );
}
