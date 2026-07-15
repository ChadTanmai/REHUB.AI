"use client";

import { useState } from "react";
import AppNav from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteNav";
import RoomGrid from "@/components/RoomGrid";
import AdminAnalytics from "@/components/AdminAnalytics";
import { getTherapistSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";
import { getStore } from "@/lib/store";
import { isActive } from "@/lib/requestUtils";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function FacilityPage() {
  const mounted = useMounted();
  useStoreVersion();
  const router = useRouter();
  const [copied, setCopied] = useState<"nurse" | "patient" | null>(null);

  useEffect(() => {
    if (!mounted) return;
    // Tenant isolation: require a staff session for a facility this account owns.
    const s = getTherapistSession();
    if (!s || !getStore().ownsFacility(s.facilityId)) router.replace("/dashboard");
  }, [mounted, router]);

  if (!mounted) {
    return (
      <>
        <AppNav />
        <main className="flex-1 bg-offwhite" />
        <SiteFooter />
      </>
    );
  }

  const therapistSession = getTherapistSession();
  if (!therapistSession || !getStore().ownsFacility(therapistSession.facilityId)) return null;
  const facilityId = therapistSession.facilityId;
  const ws = getStore().getWorkspace(facilityId);
  const active = ws.requests.filter(isActive);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://rehub-ai.vercel.app";
  const nurseLink = `${origin}/join?code=${ws.facility.facilityCode}&role=nurse`;
  const patientLink = `${origin}/join?code=${ws.facility.facilityCode}&role=patient`;

  function copy(text: string, kind: "nurse" | "patient") {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(kind);
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <>
      <AppNav facilityName={ws.facility.name} />
      <main className="flex-1 bg-offwhite">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">

          {/* Header */}
          <div className="mb-6 rounded-xl border border-gray-muted bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-navy">{ws.facility.name}</h1>
                <p className="mt-0.5 text-sm text-slate/70">
                  Facility code{" "}
                  <code className="rounded bg-offwhite px-1.5 py-0.5 font-mono text-teal">
                    {ws.facility.facilityCode}
                  </code>
                  {ws.facility.teamName ? ` · ${ws.facility.teamName}` : ""}
                </p>
                {(ws.facility.address || ws.facility.city) && (
                  <p className="mt-0.5 text-xs text-slate/60">
                    {[ws.facility.address, ws.facility.city, ws.facility.state, ws.facility.zip]
                      .filter(Boolean).join(", ")}
                    {ws.facility.phone ? ` · ${ws.facility.phone}` : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Rooms" value={ws.rooms.length} />
              <Stat label="Care team" value={ws.therapists.length} />
              <Stat label="Active requests" value={active.length} />
              <Stat label="Total requests" value={ws.requests.length} />
            </div>
          </div>

          {/* Invite section */}
          <div className="mb-6 rounded-xl border border-gray-muted bg-white p-5 shadow-soft">
            <h2 className="font-semibold text-navy">Invite your team</h2>
            <p className="mt-1 text-sm text-slate/70">
              Share these links to connect devices. Each link carries your facility code automatically.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-muted bg-offwhite p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                  Care team / Nurse
                </p>
                <p className="mt-1 break-all font-mono text-xs text-navy">{nurseLink}</p>
                <button
                  onClick={() => copy(nurseLink, "nurse")}
                  className="mt-3 rounded-md border border-gray-muted bg-white px-3 py-1.5 text-xs font-medium text-navy hover:border-navy/30"
                >
                  {copied === "nurse" ? "Copied ✓" : "Copy link"}
                </button>
              </div>
              <div className="rounded-lg border border-gray-muted bg-offwhite p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                  Patient room
                </p>
                <p className="mt-1 break-all font-mono text-xs text-navy">{patientLink}</p>
                <button
                  onClick={() => copy(patientLink, "patient")}
                  className="mt-3 rounded-md border border-gray-muted bg-white px-3 py-1.5 text-xs font-medium text-navy hover:border-navy/30"
                >
                  {copied === "patient" ? "Copied ✓" : "Copy link"}
                </button>
              </div>
            </div>
          </div>

          {/* Rooms */}
          <section className="mb-6">
            <h2 className="mb-3 text-base font-semibold text-navy">Rooms</h2>
            {ws.rooms.length ? (
              <RoomGrid rooms={ws.rooms} requests={ws.requests} />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-muted bg-white p-8 text-center text-sm text-slate/60">
                No rooms paired yet. Use the invite link above to connect a patient room.
              </div>
            )}
          </section>

          {/* Care team */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-navy">Care team</h2>
            {ws.therapists.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ws.therapists.map((t) => (
                  <div key={t.id} className="rounded-xl border border-gray-muted bg-white p-4 shadow-soft">
                    <p className="font-semibold text-navy">{t.name}</p>
                    <p className="text-sm text-slate/70">{t.role}</p>
                    <p className="mt-1 text-xs text-slate/55">
                      {t.assignedRooms === "all" ? "All rooms" : `${Array.isArray(t.assignedRooms) ? t.assignedRooms.length : 0} rooms`}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-muted bg-white p-8 text-center text-sm text-slate/60">
                No care team members yet. Use the invite link above to connect a nurse or therapist.
              </div>
            )}
          </section>

          {/* Analytics — consolidated here so Operations is one focused workspace */}
          <section id="analytics" className="mt-8 scroll-mt-20">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-navy">Analytics</h2>
              <p className="text-xs text-slate/50">Ask Hubi for natural-language insights →</p>
            </div>
            {ws.requests.length ? (
              <AdminAnalytics requests={ws.requests} />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-muted bg-white p-8 text-center text-sm text-slate/60">
                Analytics appear here once patients start sending requests.
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-muted bg-offwhite p-3 text-center">
      <p className="text-xl font-bold text-navy">{value}</p>
      <p className="text-xs text-slate/60">{label}</p>
    </div>
  );
}
