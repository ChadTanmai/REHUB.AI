"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteNav";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getAuthClient } from "@/lib/auth/supabase-browser";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function ProfilePage() {
  const { profile, signedIn, loading, refresh } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !signedIn) router.replace("/auth/signin");
  }, [loading, signedIn, router]);

  useEffect(() => {
    if (profile) {
      const parts = profile.fullName.split(" ");
      setFirstName(parts[0] ?? "");
      setLastName(parts.slice(1).join(" "));
      setDisplayName(profile.displayName);
    }
  }, [profile]);

  if (loading || !profile) {
    return (
      <>
        <AppNav />
        <main className="flex-1 bg-offwhite" />
      </>
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const fullName = `${firstName} ${lastName}`.trim();
    await getAuthClient().auth.updateUser({
      data: { full_name: fullName, display_name: displayName },
    });
    await refresh();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      <AppNav facilityName={profile.facilityName} userName={profile.displayName} />
      <main className="flex-1 bg-offwhite">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
          <h1 className="text-2xl font-bold text-navy">Profile</h1>
          <p className="mt-1 text-sm text-slate/70">Manage your personal information.</p>

          {/* Avatar + identity */}
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-gray-muted bg-white p-6 shadow-soft">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-navy text-xl font-bold text-white">
                {initials(profile.displayName)}
              </span>
            )}
            <div>
              <p className="text-lg font-semibold text-navy">{profile.fullName}</p>
              <p className="text-sm text-slate/60">{profile.email}</p>
              <span className="mt-1 inline-block rounded-full bg-teal/10 px-2.5 py-0.5 text-xs font-medium capitalize text-teal">
                {profile.role.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {/* Editable fields */}
          <div className="mt-6 rounded-2xl border border-gray-muted bg-white p-6 shadow-soft">
            <h2 className="text-base font-semibold text-navy">Personal information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="First name" value={firstName} onChange={setFirstName} />
              <Field label="Last name" value={lastName} onChange={setLastName} />
              <Field label="Display name" value={displayName} onChange={setDisplayName} />
              <Field label="Email" value={profile.email} disabled />
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2030] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              {saved && <span className="text-sm font-medium text-success">Saved ✓</span>}
            </div>
          </div>

          {/* Read-only org info */}
          <div className="mt-6 rounded-2xl border border-gray-muted bg-white p-6 shadow-soft">
            <h2 className="text-base font-semibold text-navy">Organization</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Facility" value={profile.facilityName || "Not set up yet"} />
              <Row label="Role" value={profile.role.replace(/_/g, " ")} />
              <Row label="Account status" value="Active" />
            </dl>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Field({
  label, value, onChange, disabled,
}: { label: string; value: string; onChange?: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className="input disabled:bg-offwhite disabled:text-slate/50"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-muted/60 pb-2 last:border-0">
      <dt className="text-slate/60">{label}</dt>
      <dd className="font-medium capitalize text-navy">{value}</dd>
    </div>
  );
}
