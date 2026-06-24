"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import AppNav from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteNav";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getStore } from "@/lib/store";
import { getTherapistSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";
import { isActive } from "@/lib/requestUtils";

const EASE = [0.22, 1, 0.36, 1] as const;

function BuildingIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M9 21V7l6-4v18M9 11h6M9 15h6" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function HeartPulseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

export default function DashboardPage() {
  const mounted = useMounted();
  useStoreVersion();
  const router = useRouter();
  const { profile, signedIn, loading } = useAuth();
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (!loading && !signedIn) {
      router.replace("/auth/signin?next=/dashboard");
    }
  }, [loading, signedIn, router]);

  useEffect(() => {
    const seen = sessionStorage.getItem("rehub:intro-seen");
    if (!seen) {
      setShowIntro(true);
      const t = setTimeout(() => {
        sessionStorage.setItem("rehub:intro-seen", "1");
        setShowIntro(false);
      }, 1800);
      return () => clearTimeout(t);
    }
  }, []);

  if (!mounted || loading) {
    return (
      <>
        <AppNav />
        <main className="flex-1 bg-offwhite" />
      </>
    );
  }

  if (!signedIn) return null;

  const store = getStore();
  // Tenant isolation: only resolve a facility this account actually owns.
  const session = getTherapistSession();
  const ownedFacilityId =
    session && store.ownsFacility(session.facilityId)
      ? session.facilityId
      : store.ownsFacility(profile?.facilityId)
        ? profile!.facilityId!
        : store.listFacilities()[0]?.id ?? null;
  const ws = ownedFacilityId ? store.getWorkspace(ownedFacilityId) : null;
  const hasFacility = Boolean(ws);
  const activeRequests = ws ? ws.requests.filter(isActive) : [];
  const urgentCount = activeRequests.filter((r) => r.priority === "Urgent").length;

  const firstName = profile?.displayName?.split(" ")[0] ?? profile?.fullName?.split(" ")[0] ?? "there";

  return (
    <>
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
              className="text-center"
            >
              <p className="text-3xl font-bold text-navy">Rehub</p>
              <p className="mt-1 text-sm text-slate/60">Loading your facility…</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AppNav facilityName={ws?.facility.name ?? profile?.facilityName} userName={profile?.displayName} />

      <main className="flex-1 bg-offwhite">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">

          {/* Header greeting */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="mb-6"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate/50">{formatDate()}</p>
            <h1 className="mt-1 text-2xl font-bold text-navy">
              {timeOfDay()}, {firstName}.
            </h1>
            {(ws?.facility.name || profile?.facilityName) && (
              <p className="mt-0.5 text-sm text-slate/60">
                {ws?.facility.name ?? profile?.facilityName}
                {ws && ` · ${ws.rooms.length} rooms · ${ws.therapists.length} staff`}
              </p>
            )}
          </motion.div>

          {/* Urgent alert strip */}
          <AnimatePresence>
            {urgentCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="mb-5 flex items-center justify-between rounded-xl border border-coral/40 bg-coral/8 px-5 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-coral" />
                  <div className="flex items-center gap-2">
                    <BellIcon />
                    <p className="text-sm font-semibold text-coral">
                      {urgentCount} urgent {urgentCount === 1 ? "request requires" : "requests require"} immediate attention
                    </p>
                  </div>
                </div>
                <Link href="/therapist" className="rounded-md bg-coral px-3 py-1.5 text-xs font-semibold text-white hover:bg-coral/90">
                  View now
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {!hasFacility ? (
            /* ── First-time setup ── */
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.1 }}
            >
              <div className="mb-5 rounded-xl border border-navy/20 bg-navy/5 px-5 py-4">
                <p className="text-sm font-semibold text-navy">Welcome to Rehub</p>
                <p className="mt-0.5 text-sm text-slate/70">
                  Get started by setting up your facility, then invite your care team and connect patient rooms.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: <BuildingIcon />,
                    title: "Create your facility",
                    desc: "Set up your rehabilitation center — name, rooms, and care team.",
                    label: "Get started",
                    href: "/onboarding",
                    primary: true,
                  },
                  {
                    icon: <UsersIcon />,
                    title: "Invite care team",
                    desc: "Nurses, therapists, and administrators can join after your facility is created.",
                    label: "Set up facility first",
                    href: "/onboarding",
                    primary: false,
                  },
                  {
                    icon: <HeartPulseIcon />,
                    title: "Connect patient rooms",
                    desc: "Pair room tablets so residents can submit care requests directly.",
                    label: "Set up facility first",
                    href: "/onboarding",
                    primary: false,
                  },
                ].map((card, i) => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE, delay: 0.18 + i * 0.07 }}
                  >
                    <Link
                      href={card.href}
                      className={`group flex h-full flex-col rounded-2xl border p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-panel ${
                        card.primary ? "border-navy bg-navy text-white" : "border-gray-muted bg-white"
                      }`}
                    >
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${
                        card.primary ? "bg-white/10" : "bg-offwhite text-navy"
                      }`}>
                        {card.icon}
                      </div>
                      <h2 className={`font-semibold ${card.primary ? "text-white" : "text-navy"}`}>{card.title}</h2>
                      <p className={`mt-1.5 flex-1 text-sm leading-relaxed ${card.primary ? "text-white/70" : "text-slate/70"}`}>{card.desc}</p>
                      <div className={`mt-4 flex items-center gap-1 text-sm font-semibold ${card.primary ? "text-white" : "text-teal"}`}>
                        {card.label}
                        {card.primary && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            /* ── Facility dashboard ── */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
              className="space-y-5"
            >
              {/* Quick stats */}
              {ws && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCard label="Rooms" value={ws.rooms.length} href="/facility" />
                  <StatCard label="Staff" value={ws.therapists.length} href="/facility" />
                  <StatCard label="Active requests" value={activeRequests.length} href="/therapist" />
                  <StatCard label="Urgent" value={urgentCount} href="/therapist" accent={urgentCount > 0} />
                </div>
              )}

              {/* Navigation cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <NavCard
                  icon={<HeartPulseIcon />}
                  label="Care queue"
                  desc="Live request queue and staff workflow"
                  href="/therapist"
                  primary
                />
                <NavCard
                  icon={<ChartIcon />}
                  label="Analytics"
                  desc="Response times and request volume"
                  href="/admin"
                />
                <NavCard
                  icon={<BuildingIcon />}
                  label="Facility"
                  desc="Rooms, staff, and invite links"
                  href="/facility"
                />
              </div>

              {/* Invite section */}
              {ws && (
                <div className="rounded-xl border border-gray-muted bg-white p-5 shadow-soft">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-navy">Invite to facility</h3>
                      <p className="mt-0.5 text-xs text-slate/60">Share these links to connect staff and patient rooms.</p>
                    </div>
                    <Link href="/facility" className="text-xs font-medium text-teal hover:underline">
                      Manage facility →
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <CopyLink label="Care team / Staff" href={`/join?code=${ws.facility.facilityCode}&role=nurse`} />
                    <CopyLink label="Patient room" href={`/join?code=${ws.facility.facilityCode}&role=patient`} />
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="rounded-xl border border-gray-muted bg-white p-5 shadow-soft">
                <h3 className="mb-3 text-sm font-semibold text-navy">Quick actions</h3>
                <div className="flex flex-wrap gap-2">
                  <QuickAction icon={<PlusIcon />} label="Add room" href="/facility" />
                  <QuickAction icon={<UsersIcon />} label="Add staff" href="/facility" />
                  <QuickAction icon={<ChartIcon />} label="View analytics" href="/admin" />
                  <QuickAction icon={<BuildingIcon />} label="Facility settings" href="/facility" />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function StatCard({ label, value, href, accent }: { label: string; value: number; href: string; accent?: boolean }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-muted bg-white p-5 shadow-soft transition-shadow hover:shadow-panel"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate/50">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent ? "text-coral" : "text-navy"}`}>{value}</p>
    </Link>
  );
}

function NavCard({ icon, label, desc, href, primary }: {
  icon: React.ReactNode; label: string; desc: string; href: string; primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-xl border p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-panel ${
        primary ? "border-navy bg-navy" : "border-gray-muted bg-white"
      }`}
    >
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${primary ? "bg-white/10 text-white" : "bg-offwhite text-navy"}`}>
        {icon}
      </div>
      <p className={`font-semibold ${primary ? "text-white" : "text-navy"}`}>{label}</p>
      <p className={`mt-1 text-xs ${primary ? "text-white/60" : "text-slate/60"}`}>{desc}</p>
    </Link>
  );
}

function CopyLink({ label, href }: { label: string; href: string }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${href}` : href;

  function copy() {
    navigator.clipboard.writeText(fullUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-muted bg-offwhite px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate">{label}</p>
        <p className="mt-0.5 max-w-[200px] truncate font-mono text-xs text-slate/50">{fullUrl}</p>
      </div>
      <button
        onClick={copy}
        className="ml-3 shrink-0 rounded-md border border-gray-muted bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-offwhite"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

function QuickAction({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-gray-muted bg-offwhite px-3 py-2 text-sm font-medium text-navy hover:border-navy/30 hover:bg-white transition-colors"
    >
      <span className="text-slate/60">{icon}</span>
      {label}
    </Link>
  );
}
