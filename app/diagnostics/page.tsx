"use client";

/**
 * Patient → nurse delivery diagnostics.
 *
 * Runs the real cross-device pipeline and reports the exact stage that fails,
 * so we never have to guess why a nurse isn't seeing patient messages:
 *
 *   1. Supabase session present?       (auth)
 *   2. Facility resolved + owned?       (tenant)
 *   3. Facility published to cloud?     (lookup RPC)
 *   4. submit_patient_request works?    (write path / table + function exist)
 *   5. patient_messages readable?       (read path / RLS)
 *
 * Visit /diagnostics on the nurse/admin device.
 */

import { useState } from "react";
import AppNav from "@/components/AppNav";
import { getStore } from "@/lib/store";
import { getTherapistSession } from "@/lib/session";
import { useMounted } from "@/lib/useRehub";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getAuthClient } from "@/lib/auth/supabase-browser";
import { submitPatientRequest, fetchFacilityRequestsDiag } from "@/lib/supabase/requests";
import { lookupFacilityWithRooms } from "@/lib/supabase/facilities";

type StageState = "pending" | "pass" | "fail" | "warn";
interface Stage {
  key: string;
  label: string;
  state: StageState;
  detail: string;
}

function Dot({ state }: { state: StageState }) {
  const color =
    state === "pass" ? "#16a34a" : state === "fail" ? "#dc2626" : state === "warn" ? "#d97706" : "#94a3b8";
  return <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />;
}

export default function DiagnosticsPage() {
  const mounted = useMounted();
  const { profile } = useAuth();
  const [stages, setStages] = useState<Stage[]>([]);
  const [running, setRunning] = useState(false);

  if (!mounted) return <><AppNav /><main className="min-h-screen bg-offwhite" /></>;

  const store = getStore();
  const session = getTherapistSession();
  const facilityId =
    session && store.ownsFacility(session.facilityId)
      ? session.facilityId
      : store.ownsFacility(profile?.facilityId)
        ? profile!.facilityId!
        : store.listFacilities()[0]?.id ?? null;

  async function run() {
    setRunning(true);
    const out: Stage[] = [];
    const push = (s: Stage) => { out.push(s); setStages([...out]); };

    // 1. Supabase session.
    let uid: string | null = null;
    try {
      const { data } = await getAuthClient().auth.getUser();
      uid = data.user?.id ?? null;
      push({
        key: "auth", label: "Supabase session",
        state: uid ? "pass" : "fail",
        detail: uid ? `Signed in as ${data.user?.email ?? uid}` : "No Supabase session — sign in on this device.",
      });
    } catch (e) {
      push({ key: "auth", label: "Supabase session", state: "fail", detail: String(e) });
    }

    // 2. Facility resolved + owned.
    if (!facilityId) {
      push({ key: "fac", label: "Facility resolved", state: "fail", detail: "No owned facility on this device. Create or publish one first." });
      setRunning(false);
      return;
    }
    const ws = store.getWorkspace(facilityId);
    const code = ws.facility.facilityCode;
    const room = ws.rooms[0];
    push({
      key: "fac", label: "Facility resolved",
      state: "pass",
      detail: `${ws.facility.name} · code ${code} · id ${facilityId.slice(0, 8)}… · ${ws.rooms.length} room(s)`,
    });

    // 3. Facility published to cloud (public lookup RPC).
    let publishedId: string | null = null;
    try {
      const remote = await lookupFacilityWithRooms(code);
      publishedId = remote?.id ?? null;
      push({
        key: "pub", label: "Facility published to cloud",
        state: remote ? "pass" : "fail",
        detail: remote
          ? `Found in cloud · ${remote.rooms.length} room(s) · id ${remote.id.slice(0, 8)}…`
          : "Not found by public lookup — click “Sync all to cloud” on the Rooms page.",
      });
      if (remote && remote.id !== facilityId) {
        push({
          key: "idmatch", label: "Local id matches cloud id",
          state: "warn",
          detail: `Local ${facilityId.slice(0, 8)}… ≠ cloud ${remote.id.slice(0, 8)}… — messages may land under a different id.`,
        });
      }
    } catch (e) {
      push({ key: "pub", label: "Facility published to cloud", state: "fail", detail: String(e) });
    }

    // 4. Write path: submit a test request via the RPC.
    const submit = await submitPatientRequest({
      facilityCode: code,
      roomId: room?.id ?? "00000000-0000-0000-0000-000000000000",
      roomNumber: room?.roomNumber ?? "TEST",
      residentName: "Diagnostic Test",
      text: "Diagnostic test message — safe to resolve.",
      source: "Diagnostic",
      requestType: "Help",
      priority: "Routine",
      urgencyLevel: "Low",
      triageReason: "Pipeline diagnostic",
      suggestedAction: "No action needed",
    });
    push({
      key: "write", label: "submit_patient_request (write path)",
      state: submit.id ? "pass" : "fail",
      detail: submit.id
        ? `Inserted message id ${submit.id.slice(0, 8)}…`
        : `FAILED: ${submit.error ?? "unknown"}`,
    });

    // 5. Read path: can the nurse read patient_messages (RLS)?
    const read = await fetchFacilityRequestsDiag(facilityId);
    push({
      key: "read", label: "Read patient_messages (RLS)",
      state: read.error ? "fail" : "pass",
      detail: read.error
        ? `FAILED: ${read.error}`
        : `Readable · ${read.rows.length} message(s) for this facility${read.rows.length ? ` · latest: “${(read.rows[0].text ?? "").slice(0, 40)}”` : ""}`,
    });

    setRunning(false);
  }

  return (
    <>
      <AppNav facilityName={facilityId ? store.getWorkspace(facilityId).facility.name : undefined} />
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-navy">Delivery diagnostics</h1>
        <p className="mt-1 text-sm text-slate/60">
          Runs the real patient → nurse pipeline on this device and shows the exact stage that fails.
        </p>

        <button onClick={run} disabled={running}
          className="mt-5 rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2030] disabled:opacity-50">
          {running ? "Running…" : "Run delivery test"}
        </button>

        <div className="mt-6 space-y-2.5">
          {stages.map((s) => (
            <div key={s.key} className="flex items-start gap-3 rounded-xl border border-gray-muted bg-white px-4 py-3 shadow-soft">
              <Dot state={s.state} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">{s.label}</p>
                <p className="mt-0.5 break-words text-xs text-slate/70">{s.detail}</p>
              </div>
            </div>
          ))}
          {stages.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-muted bg-white px-4 py-8 text-center text-sm text-slate/50">
              Click “Run delivery test” to trace the pipeline.
            </p>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-teal/20 bg-teal/5 px-4 py-3 text-xs text-teal">
          <p className="font-semibold">How to read this</p>
          <p className="mt-1">
            A red “write path” or “read path” almost always means the <code>patient_messages</code> table /
            <code> submit_patient_request</code> function isn’t in Supabase yet — run migration 0007. A red
            “published” means click <strong>Sync all to cloud</strong> on the Rooms page.
          </p>
        </div>
      </main>
    </>
  );
}
