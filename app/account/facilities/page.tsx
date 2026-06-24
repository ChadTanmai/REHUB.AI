"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteNav";
import { getStore } from "@/lib/store";
import { getTherapistSession, saveTherapistSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";
import { useAuth } from "@/lib/auth/AuthProvider";
import { normalizeFacilityCode } from "@/lib/security";
import { saveUserFacilityToMeta, upsertFacilityFromStore } from "@/lib/supabase/facilities";
import type { Facility } from "@/lib/types";

const EMPTY = { name: "", facilityCode: "", teamName: "Care Team" };

export default function ManageFacilitiesPage() {
  const mounted = useMounted();
  const router = useRouter();
  const { profile, signedIn, loading, refresh } = useAuth();
  useStoreVersion();

  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !signedIn) router.replace("/auth/signin");
  }, [loading, signedIn, router]);

  if (!mounted || loading) {
    return (
      <>
        <AppNav />
        <main className="min-h-screen flex-1 bg-offwhite" />
      </>
    );
  }

  const store = getStore();
  const facilities = store.listFacilities();
  const session = getTherapistSession();
  const activeFacilityId = session?.facilityId ?? profile?.facilityId ?? null;

  function startCreate() {
    setForm(EMPTY);
    setCreating(true);
    setEditing(null);
    setFormError("");
  }

  function startEdit(f: Facility) {
    setForm({ name: f.name, facilityCode: f.facilityCode, teamName: f.teamName });
    setEditing(f.id);
    setCreating(false);
    setFormError("");
  }

  function validate(excludeId?: string): string {
    if (!form.name.trim()) return "Facility name is required.";
    const code = normalizeFacilityCode(form.facilityCode);
    if (!code) return "A facility code is required.";
    const dup = facilities.find(
      (f) => f.facilityCode.toUpperCase() === code.toUpperCase() && f.id !== excludeId,
    );
    if (dup) return `Code ${code} is already used by another facility.`;
    return "";
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setFormError(err); return; }
    const facility = store.createFacility({
      name: form.name.trim(),
      facilityCode: normalizeFacilityCode(form.facilityCode),
      roomCount: 0,
      teamName: form.teamName.trim() || "Care Team",
    });
    // Publish to Supabase so the code works from any device.
    if (signedIn) {
      upsertFacilityFromStore({
        id: facility.id,
        name: facility.name,
        facilityCode: facility.facilityCode,
        teamName: facility.teamName,
      }).catch(() => {});
    }
    setCreating(false);
    setForm(EMPTY);
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const err = validate(editing);
    if (err) { setFormError(err); return; }
    const updated = store.updateFacility(editing, {
      name: form.name.trim(),
      facilityCode: normalizeFacilityCode(form.facilityCode),
      teamName: form.teamName.trim() || "Care Team",
    });
    if (signedIn && updated) {
      upsertFacilityFromStore({
        id: updated.id,
        name: updated.name,
        facilityCode: updated.facilityCode,
        teamName: updated.teamName,
      }).catch(() => {});
    }
    setEditing(null);
    setForm(EMPTY);
  }

  function handleDelete(id: string) {
    store.deleteFacility(id);
    setDeleteConfirm(null);
  }

  async function handleSetActive(f: Facility) {
    // Make this facility the user's active workspace.
    const therapist = store.getWorkspace(f.id).therapists[0]
      ?? store.addTherapist(f.id, { name: profile?.displayName ?? "Administrator", role: "Nurse", assignedRooms: "all" });
    saveTherapistSession({
      deviceType: "therapist",
      facilityId: f.id,
      facilityCode: f.facilityCode,
      therapistId: therapist.id,
      name: therapist.name,
      role: therapist.role,
      assignedRooms: "all",
      pairedAt: new Date().toISOString(),
    });
    if (signedIn) {
      await saveUserFacilityToMeta(f.id, f.name).catch(() => {});
      await refresh().catch(() => {});
    }
    router.push("/dashboard");
  }

  const showForm = creating || editing !== null;

  return (
    <>
      <AppNav />
      <main className="min-h-screen flex-1 bg-offwhite">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          {/* Breadcrumb */}
          <Link href="/account/profile" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate/60 hover:text-navy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to profile
          </Link>

          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-navy">Manage facilities</h1>
              <p className="mt-0.5 text-sm text-slate/60">
                Add, edit, or remove the facilities you administer.
              </p>
            </div>
            {!showForm && (
              <button onClick={startCreate}
                className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2030]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                New facility
              </button>
            )}
          </div>

          {/* Form (create or edit) */}
          {showForm && (
            <form onSubmit={creating ? handleCreate : handleEdit}
              className="mb-6 rounded-2xl border border-teal/30 bg-white p-5 shadow-soft">
              <h2 className="mb-4 font-semibold text-navy">
                {creating ? "New facility" : "Edit facility"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate">Facility name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Green Valley Recovery" className="input" autoFocus />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate">Join code *</label>
                  <input value={form.facilityCode}
                    onChange={e => setForm(f => ({ ...f, facilityCode: e.target.value.toUpperCase() }))}
                    placeholder="RH8472" className="input font-mono tracking-widest" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate">Care team name</label>
                  <input value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))}
                    placeholder="Care Team" className="input" />
                </div>
              </div>
              {formError && <p className="mt-2 text-sm text-coral">{formError}</p>}
              <div className="mt-4 flex gap-2">
                <button type="submit"
                  className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c2030]">
                  {creating ? "Create facility" : "Save changes"}
                </button>
                <button type="button" onClick={() => { setCreating(false); setEditing(null); setForm(EMPTY); setFormError(""); }}
                  className="rounded-lg border border-gray-muted px-4 py-2 text-sm font-medium text-slate hover:bg-offwhite">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Empty state */}
          {facilities.length === 0 && !showForm && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-muted bg-white py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-navy/5 text-navy">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-navy">No facilities yet</p>
              <p className="mt-1 text-sm text-slate/60">Create your first facility to get started.</p>
              <button onClick={startCreate}
                className="mt-4 rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2030]">
                Create facility
              </button>
            </div>
          )}

          {/* Facility list */}
          {facilities.length > 0 && (
            <div className="space-y-3">
              {facilities.map((f) => {
                const isActive = f.id === activeFacilityId;
                const ws = store.getWorkspace(f.id);
                return (
                  <div key={f.id}
                    className={`rounded-2xl border bg-white p-5 shadow-soft transition-shadow hover:shadow-panel ${
                      isActive ? "border-teal/50" : "border-gray-muted"
                    }`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-lg font-bold text-navy">{f.name}</p>
                          {isActive && (
                            <span className="shrink-0 rounded-full bg-teal/10 px-2 py-0.5 text-xs font-semibold text-teal">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-sm font-medium text-slate/60">{f.facilityCode}</p>
                        <p className="mt-1 text-xs text-slate/50">
                          {ws.rooms.length} room{ws.rooms.length !== 1 ? "s" : ""} · {f.teamName}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!isActive && (
                          <button onClick={() => handleSetActive(f)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal/5">
                            Open
                          </button>
                        )}
                        <button onClick={() => startEdit(f)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate hover:bg-offwhite">
                          Edit
                        </button>
                        {deleteConfirm === f.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(f.id)}
                              className="rounded-lg bg-coral/10 px-2.5 py-1.5 text-xs font-semibold text-coral hover:bg-coral/20">
                              Delete
                            </button>
                            <button onClick={() => setDeleteConfirm(null)}
                              className="rounded-lg px-2.5 py-1.5 text-xs text-slate hover:bg-offwhite">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(f.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate/50 hover:text-coral">
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    {deleteConfirm === f.id && (
                      <p className="mt-3 rounded-lg bg-coral/5 px-3 py-2 text-xs text-coral">
                        This permanently removes <span className="font-semibold">{f.name}</span> and all its rooms, requests, and history. This cannot be undone.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
