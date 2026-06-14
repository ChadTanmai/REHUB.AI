"use client";

import { useState } from "react";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import ResidentRequestPanel from "@/components/ResidentRequestPanel";
import StaffDashboard from "@/components/StaffDashboard";
import AdminAnalytics from "@/components/AdminAnalytics";
import SafetyNote from "@/components/SafetyNote";
import { getStore } from "@/lib/store";
import { DEMO_FACILITY, DEMO_ROOMS } from "@/lib/mockData";
import { useMounted, useWorkspace } from "@/lib/useRehub";

type Tab = "resident" | "staff" | "admin";

const TABS: { id: Tab; label: string; role: string; desc: string }[] = [
  {
    id: "resident",
    label: "Room screen",
    role: "Patient / Resident",
    desc: "Submit a request by tapping a button or speaking. Confirm before sending.",
  },
  {
    id: "staff",
    label: "Therapist dashboard",
    role: "Therapist / Nurse",
    desc: "See all incoming requests sorted by urgency. Acknowledge, assign, resolve.",
  },
  {
    id: "admin",
    label: "Admin analytics",
    role: "Facility Administrator",
    desc: "Response times, request volume, and workflow trends across the facility.",
  },
];

export default function DemoPage() {
  const mounted = useMounted();
  const workspace = useWorkspace(DEMO_FACILITY.id);
  const [tab, setTab] = useState<Tab>("staff");
  const room = DEMO_ROOMS.find((r) => r.roomNumber === "204") ?? DEMO_ROOMS[0];
  const activeTab = TABS.find((t) => t.id === tab)!;

  function reset() {
    getStore().resetFacility(DEMO_FACILITY.id);
  }

  return (
    <>
      <MarketingNav />
      <main className="flex-1 bg-offwhite">
        {/* Header */}
        <section className="border-b border-gray-muted bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-teal">
                  Interactive demo
                </p>
                <h1 className="mt-2 text-3xl font-bold text-navy sm:text-4xl">
                  See the full care communication loop.
                </h1>
                <p className="mt-3 max-w-2xl text-slate">
                  Submit a request as a resident, then switch to the therapist
                  dashboard to see it arrive in real time. All data is fictional
                  — nothing is stored outside this browser.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-gray-muted bg-white px-4 py-2 text-sm font-medium text-slate transition-colors hover:border-navy/30 hover:text-navy"
                >
                  Reset demo data
                </button>
                <Link
                  href="/onboarding"
                  className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a8d8d]"
                >
                  Set up your facility →
                </Link>
              </div>
            </div>

            {/* Step hint */}
            <div className="mt-6 rounded-lg border border-gray-muted bg-offwhite px-4 py-3 text-sm text-slate/80">
              <span className="font-semibold text-navy">Try the loop: </span>
              Switch to <strong>Room screen</strong>, submit a request, then
              switch to <strong>Therapist dashboard</strong> and watch it arrive.
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {/* Tab switcher */}
          <div className="mb-6 grid gap-2 sm:grid-cols-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  tab === t.id
                    ? "border-teal bg-white shadow-panel ring-1 ring-teal/30"
                    : "border-gray-muted bg-white hover:border-teal/40"
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wider ${tab === t.id ? "text-teal" : "text-slate/50"}`}>
                  {t.role}
                </p>
                <p className="mt-1 font-semibold text-navy">{t.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate/70">{t.desc}</p>
              </button>
            ))}
          </div>

          {/* Panel label */}
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-teal" />
            <p className="text-sm font-medium text-slate">
              Viewing as: <span className="font-semibold text-navy">{activeTab.role}</span>
              {" "}·{" "}
              <span className="text-slate/60">{DEMO_FACILITY.name}</span>
            </p>
          </div>

          {/* Content */}
          {!mounted ? (
            <div className="h-96 animate-pulse rounded-xl border border-gray-muted bg-white" />
          ) : tab === "resident" ? (
            <div className="mx-auto max-w-xl">
              <div className="mb-4 rounded-lg border border-amber/30 bg-amber/8 px-4 py-2.5 text-sm text-[#8a6300]">
                <strong>Demo room:</strong> Room 204 · Margaret · Maplewood Rehabilitation
              </div>
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

          <div className="mt-8 border-t border-gray-muted pt-6">
            <SafetyNote variant="compact" />
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
