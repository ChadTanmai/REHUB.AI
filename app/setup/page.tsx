"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { getStore } from "@/lib/store";
import { DEMO_FACILITY, DEMO_FACILITY_CODE } from "@/lib/mockData";
import { DEMO_DATA_NOTICE, normalizeFacilityCode } from "@/lib/security";
import { useMounted } from "@/lib/useRehub";

export default function SetupPage() {
  const mounted = useMounted();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState("8");
  const [team, setTeam] = useState("");
  const [created, setCreated] = useState<{ name: string; code: string } | null>(
    null,
  );

  function createFacility(e: React.FormEvent) {
    e.preventDefault();
    const facility = getStore().createFacility({
      name: name || "New Facility",
      facilityCode: normalizeFacilityCode(code) || `REHUB-${Date.now() % 10000}`,
      roomCount: parseInt(rooms, 10) || 0,
      teamName: team || "Care Team",
    });
    setCreated({ name: facility.name, code: facility.facilityCode });
  }

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <h1 className="text-3xl font-bold text-navy">Facility Setup</h1>
          <p className="mt-2 text-slate">
            Create a facility workspace, then pair room devices and therapist
            dashboards to it.
          </p>

          <Notice />

          {/* Quick demo path */}
          <div className="mt-6 rounded-xl border border-teal/30 bg-mint/50 p-5">
            <h2 className="text-base font-semibold text-navy">Use the demo facility</h2>
            <p className="mt-1 text-sm text-slate">
              Skip setup and explore with{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-teal">
                {DEMO_FACILITY_CODE}
              </code>{" "}
              — {DEMO_FACILITY.name}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/setup/room"
                className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a8d8d]"
              >
                Pair a room
              </Link>
              <Link
                href="/setup/therapist"
                className="rounded-lg border-2 border-navy bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-navy/5"
              >
                Pair a therapist
              </Link>
              <Link
                href="/facility"
                className="rounded-lg border border-gray-muted bg-white px-4 py-2 text-sm font-medium text-slate hover:bg-offwhite"
              >
                Facility overview
              </Link>
            </div>
          </div>

          {/* Create a facility */}
          <form
            onSubmit={createFacility}
            className="mt-8 space-y-4 rounded-xl border border-gray-muted bg-white p-5"
          >
            <h2 className="text-base font-semibold text-navy">Create a new facility</h2>
            <Field label="Facility name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maplewood Rehabilitation"
                className="input"
              />
            </Field>
            <Field label="Facility code">
              <input
                value={code}
                onChange={(e) => setCode(normalizeFacilityCode(e.target.value))}
                placeholder="e.g. MAPLE-01"
                className="input"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Number of rooms">
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={rooms}
                  onChange={(e) => setRooms(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Therapist team name">
                <input
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  placeholder="e.g. Maplewood Care Team"
                  className="input"
                />
              </Field>
            </div>
            <button
              type="submit"
              disabled={!mounted}
              className="w-full rounded-lg bg-navy px-5 py-3 font-semibold text-white hover:bg-[#0c2030] disabled:opacity-50"
            >
              Create facility
            </button>

            {created && (
              <div className="rounded-lg border border-success/30 bg-success/8 p-4 text-sm">
                <p className="font-semibold text-navy">
                  Created “{created.name}”.
                </p>
                <p className="mt-1 text-slate">
                  Facility code:{" "}
                  <code className="rounded bg-white px-1.5 py-0.5 text-teal">
                    {created.code}
                  </code>
                  . Use this code to pair rooms and therapists.
                </p>
              </div>
            )}
          </form>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate">{label}</span>
      {children}
    </label>
  );
}

function Notice() {
  return (
    <p className="mt-4 rounded-lg border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm text-[#8a6300]">
      {DEMO_DATA_NOTICE}
    </p>
  );
}
