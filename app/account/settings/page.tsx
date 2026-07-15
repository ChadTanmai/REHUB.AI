"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteNav";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getAuthClient } from "@/lib/auth/supabase-browser";
import MfaSetup from "@/components/account/MfaSetup";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem("rehub:theme", theme);
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export default function SettingsPage() {
  const { profile, signedIn, loading, signOut, signOutAllDevices } = useAuth();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("light");

  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const [notifs, setNotifs] = useState({ email: true, system: true, urgent: true });

  useEffect(() => {
    if (!loading && !signedIn) router.replace("/auth/signin");
  }, [loading, signedIn, router]);

  useEffect(() => {
    // localStorage is a browser-only API — can't read it during SSR/initial
    // render, so this genuinely needs to run post-mount in an effect.
    const saved = (localStorage.getItem("rehub:theme") as Theme) ?? "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    setTheme(saved);
    try {
      const n = localStorage.getItem("rehub:notifs");
      if (n) setNotifs(JSON.parse(n));
    } catch {}
  }, []);

  function changeTheme(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  function toggleNotif(key: keyof typeof notifs) {
    const next = { ...notifs, [key]: !notifs[key] };
    setNotifs(next);
    localStorage.setItem("rehub:notifs", JSON.stringify(next));
  }

  async function handlePasswordChange() {
    if (newPassword.length < 8) {
      setPwMsg("Password must be at least 8 characters.");
      return;
    }
    setPwSaving(true);
    setPwMsg("");
    const { error } = await getAuthClient().auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) setPwMsg(error.message);
    else {
      setPwMsg("Password updated successfully.");
      setNewPassword("");
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  async function handleSignOutAll() {
    await signOutAllDevices();
    router.push("/");
  }

  if (loading || !profile) {
    return (
      <>
        <AppNav />
        <main className="flex-1 bg-offwhite" />
      </>
    );
  }

  return (
    <>
      <AppNav facilityName={profile.facilityName} />
      <main className="flex-1 bg-offwhite">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
          <h1 className="text-2xl font-bold text-navy">Settings</h1>
          <p className="mt-1 text-sm text-slate/70">Manage your preferences and security.</p>

          <Section title="Appearance" desc="Choose how Rehub looks on this device.">
            <div className="flex gap-2">
              {(["light", "dark", "system"] as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => changeTheme(t)}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                    theme === t
                      ? "border-navy bg-navy text-white"
                      : "border-gray-muted bg-white text-slate hover:border-navy/30"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Notifications" desc="Control what you're notified about.">
            <div className="space-y-1">
              <Toggle label="Email notifications" desc="Account and security emails" on={notifs.email} onToggle={() => toggleNotif("email")} />
              <Toggle label="System notifications" desc="In-app activity updates" on={notifs.system} onToggle={() => toggleNotif("system")} />
              <Toggle label="Urgent request alerts" desc="Immediate alerts for urgent care requests" on={notifs.urgent} onToggle={() => toggleNotif("urgent")} />
            </div>
          </Section>

          <Section title="Security" desc="Update your password and manage access.">
            <label className="mb-1 block text-sm font-medium text-slate">New password</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="input flex-1"
              />
              <button
                onClick={handlePasswordChange}
                disabled={pwSaving || !newPassword}
                className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2030] disabled:opacity-50"
              >
                {pwSaving ? "Updating…" : "Update"}
              </button>
            </div>
            {pwMsg && (
              <p className={`mt-2 text-sm ${pwMsg.includes("success") ? "text-success" : "text-coral"}`}>
                {pwMsg}
              </p>
            )}

            <div className="mt-6 border-t border-gray-muted pt-5">
              <p className="mb-2 text-sm font-semibold text-navy">Two-factor authentication</p>
              <MfaSetup />
            </div>
          </Section>

          <Section title="Account" desc="Sign out or manage your session.">
            <div className="space-y-2">
              <button
                onClick={handleSignOut}
                className="w-full rounded-lg border border-gray-muted bg-white px-4 py-2.5 text-left text-sm font-medium text-navy hover:bg-offwhite"
              >
                Sign out of this device
              </button>
              <button
                onClick={handleSignOutAll}
                className="w-full rounded-lg border border-gray-muted bg-white px-4 py-2.5 text-left text-sm font-medium text-coral hover:bg-coral/5"
              >
                Sign out of all devices
              </button>
            </div>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-gray-muted bg-white p-6 shadow-soft">
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <p className="mt-0.5 text-sm text-slate/60">{desc}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Toggle({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-navy">{label}</p>
        <p className="text-xs text-slate/60">{desc}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-teal" : "bg-gray-muted"}`}
        aria-pressed={on}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
