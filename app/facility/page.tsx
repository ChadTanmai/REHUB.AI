"use client";

import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import RoomGrid from "@/components/RoomGrid";
import { DEMO_FACILITY } from "@/lib/mockData";
import { getRoomSession, getTherapistSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";
import { getStore } from "@/lib/store";
import { isActive } from "@/lib/requestUtils";

export default function FacilityPage() {
  const mounted = useMounted();
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

  // Prefer a paired session's facility, else the demo facility.
  const session = getTherapistSession() ?? getRoomSession();
  const facilityId = session?.facilityId ?? DEMO_FACILITY.id;
  const ws = getStore().getWorkspace(facilityId);
  const active = ws.requests.filter(isActive);

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-navy">{ws.facility.name}</h1>
              <p className="mt-1 text-slate">
                Facility code{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-teal">
                  {ws.facility.facilityCode}
                </code>{" "}
                · {ws.facility.teamName}
              </p>
              {(ws.facility.address || ws.facility.city) && (
                <p className="mt-0.5 text-sm text-slate/70">
                  {[
                    ws.facility.address,
                    ws.facility.city,
                    ws.facility.state,
                    ws.facility.zip,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  {ws.facility.phone ? ` · ${ws.facility.phone}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/setup/room" className="btn-primary">
                Pair room
              </Link>
              <Link href="/setup/therapist" className="btn-outline">
                Pair therapist
              </Link>
            </div>
          </header>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rooms" value={ws.rooms.length} />
            <Stat label="Therapists" value={ws.therapists.length} />
            <Stat label="Active requests" value={active.length} />
            <Stat label="Total requests" value={ws.requests.length} />
          </div>

          {/* Architecture explainer */}
          <div className="mt-6 rounded-xl border border-gray-muted bg-white p-5">
            <h2 className="text-base font-semibold text-navy">
              How this facility is connected
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate/80">
              Rehub connects patient room screens and therapist dashboards through
              a shared facility workspace. Each room device submits requests into
              the facility queue, and every authorized therapist dashboard
              subscribed to that facility receives updates in real time. Devices
              never talk to each other directly — they communicate through the
              Rehub server layer.
            </p>
          </div>

          {/* Rooms */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-navy">Rooms</h2>
            {ws.rooms.length ? (
              <RoomGrid rooms={ws.rooms} requests={ws.requests} />
            ) : (
              <p className="rounded-lg border border-dashed border-gray-muted bg-white p-6 text-sm text-slate/60">
                No rooms paired yet.
              </p>
            )}
          </section>

          {/* Therapists */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-navy">Care team</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ws.therapists.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-gray-muted bg-white p-4 shadow-soft"
                >
                  <p className="font-semibold text-navy">{t.name}</p>
                  <p className="text-sm text-slate/70">{t.role}</p>
                  <p className="mt-1 text-xs text-slate/55">
                    {t.assignedRooms === "all"
                      ? "All rooms"
                      : `${t.assignedRooms.length} rooms`}
                  </p>
                </div>
              ))}
              {ws.therapists.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-muted bg-white p-6 text-sm text-slate/60">
                  No therapists paired yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-muted bg-white p-3 shadow-soft">
      <p className="text-xs font-medium text-slate/60">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-navy">{value}</p>
    </div>
  );
}
