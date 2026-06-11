"use client";

import { SiteNav, SiteFooter } from "@/components/SiteNav";
import ResidentRequestPanel from "@/components/ResidentRequestPanel";
import SafetyNote from "@/components/SafetyNote";
import { DEMO_FACILITY, DEMO_ROOMS } from "@/lib/mockData";
import { useMounted } from "@/lib/useRehub";

export default function ResidentPage() {
  const mounted = useMounted();
  const room = DEMO_ROOMS.find((r) => r.roomNumber === "204") ?? DEMO_ROOMS[0];

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
          <header className="text-center">
            <h1 className="text-2xl font-bold text-navy sm:text-3xl">
              Rehub Resident Portal
            </h1>
            <p className="mt-2 text-lg text-slate">What do you need help with?</p>
            <p className="mt-1 text-sm text-teal">
              Connected to Rehub facility network
            </p>
          </header>

          <div className="mt-8">
            {mounted ? (
              <ResidentRequestPanel facilityId={DEMO_FACILITY.id} roomId={room.id} />
            ) : (
              <div className="h-64 animate-pulse rounded-2xl border border-gray-muted bg-white" />
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
