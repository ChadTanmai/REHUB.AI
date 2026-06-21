"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AppNav from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteNav";
import { getStore } from "@/lib/store";
import { getTherapistSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";
import { isActive } from "@/lib/requestUtils";
import { RehubWordmark } from "@/components/RehubLogo";
import Link from "next/link";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Icon components — inline SVG, no external dependency */
function BuildingIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M9 21V7l6-4v18M9 11h6M9 15h6" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

interface SetupCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  href: string;
  complete?: boolean;
}

export default function DashboardPage() {
  const mounted = useMounted();
  useStoreVersion();
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    // Only show the intro animation on first visit
    const seen = sessionStorage.getItem("rehub:intro-seen");
    if (!seen) {
      setShowIntro(true);
      setTimeout(() => {
        sessionStorage.setItem("rehub:intro-seen", "1");
        setShowIntro(false);
      }, 2000);
    }
  }, []);

  if (!mounted) {
    return (
      <>
        <AppNav />
        <main className="flex-1 bg-offwhite" />
      </>
    );
  }

  const session = getTherapistSession();
  const store = getStore();

  // Determine if this user has a real facility set up
  const hasFacility = Boolean(session?.facilityId);
  const ws = hasFacility ? store.getWorkspace(session!.facilityId) : null;
  const activeRequests = ws ? ws.requests.filter(isActive) : [];
  const urgentCount = activeRequests.filter((r) => r.priority === "Urgent").length;

  const setupCards: SetupCard[] = [
    {
      id: "facility",
      icon: <BuildingIcon />,
      title: "Create Facility",
      description: "Set up your rehabilitation center — name, address, departments, and capacity.",
      action: "Get started",
      href: "/onboarding",
      complete: hasFacility,
    },
    {
      id: "staff",
      icon: <UsersIcon />,
      title: "Add Staff",
      description: "Invite nurses, therapists, and administrators to your facility dashboard.",
      action: hasFacility ? "Invite staff" : "Set up facility first",
      href: hasFacility ? `/join?code=${ws?.facility.facilityCode}&role=nurse` : "/onboarding",
    },
    {
      id: "patients",
      icon: <HeartIcon />,
      title: "Add Patients",
      description: "Connect patient room devices so residents can submit care requests directly.",
      action: hasFacility ? "Add patient room" : "Set up facility first",
      href: hasFacility ? `/join?code=${ws?.facility.facilityCode}&role=patient` : "/onboarding",
    },
  ];

  return (
    <>
      {/* First-visit intro animation */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
            >
              <RehubWordmark size="large" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AppNav
        facilityName={ws?.facility.name}
        userName={session?.name}
      />

      <main className="flex-1 bg-offwhite">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <h1 className="text-2xl font-bold text-navy">
              {hasFacility
                ? `Welcome back${session?.name ? `, ${session.name.split(" ")[0]}` : ""}`
                : "Welcome to Rehub"}
            </h1>
            <p className="mt-1 text-sm text-slate/70">
              {hasFacility
                ? `${ws?.facility.name} · ${ws?.rooms.length ?? 0} rooms · ${ws?.therapists.length ?? 0} staff`
                : "Let's set up your rehabilitation facility."}
            </p>
          </motion.div>

          {/* Live alert strip — only when facility is set up and there are urgent requests */}
          {hasFacility && urgentCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE, delay: 0.1 }}
              className="mt-5 flex items-center justify-between rounded-xl border border-coral/30 bg-coral/8 px-5 py-3.5"
            >
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 animate-pulse rounded-full bg-coral" />
                <p className="text-sm font-semibold text-coral">
                  {urgentCount} urgent {urgentCount === 1 ? "request" : "requests"} need attention
                </p>
              </div>
              <Link
                href="/therapist"
                className="text-sm font-semibold text-coral hover:underline"
              >
                View now →
              </Link>
            </motion.div>
          )}

          {/* Setup cards — always shown until all steps complete */}
          {!hasFacility && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.15 }}
              className="mt-8 grid gap-4 sm:grid-cols-3"
            >
              {setupCards.map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.2 + i * 0.08 }}
                >
                  <Link
                    href={card.href}
                    className={`group flex h-full flex-col rounded-2xl border bg-white p-6 shadow-soft transition-all hover:shadow-panel hover:-translate-y-0.5 ${
                      card.complete
                        ? "border-teal/30 bg-teal/4"
                        : "border-gray-muted"
                    }`}
                  >
                    <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                      card.complete ? "bg-teal/10 text-teal" : "bg-offwhite text-navy"
                    }`}>
                      {card.icon}
                    </div>
                    <h2 className="font-semibold text-navy">{card.title}</h2>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate/70">
                      {card.description}
                    </p>
                    <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-navy group-hover:gap-2 transition-all">
                      {card.complete ? "✓ Complete" : card.action}
                      {!card.complete && <ChevronIcon />}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Facility dashboard — only when set up */}
          {hasFacility && ws && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.15 }}
              className="mt-8 space-y-5"
            >
              {/* Quick stats */}
              <div className="grid gap-4 sm:grid-cols-4">
                {[
                  { label: "Rooms", value: ws.rooms.length, href: "/facility" },
                  { label: "Staff", value: ws.therapists.length, href: "/facility" },
                  { label: "Active requests", value: activeRequests.length, href: "/therapist" },
                  { label: "Urgent", value: urgentCount, href: "/therapist", accent: urgentCount > 0 },
                ].map((s) => (
                  <Link
                    key={s.label}
                    href={s.href}
                    className="rounded-xl border border-gray-muted bg-white p-5 shadow-soft hover:shadow-panel transition-shadow"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-slate/50">{s.label}</p>
                    <p className={`mt-1 text-3xl font-bold ${s.accent ? "text-coral" : "text-navy"}`}>
                      {s.value}
                    </p>
                  </Link>
                ))}
              </div>

              {/* Quick nav */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Care team dashboard", desc: "Live request queue and response workflow", href: "/therapist", primary: true },
                  { label: "Analytics", desc: "Response times and request trends", href: "/admin", primary: false },
                  { label: "Facility management", desc: "Rooms, staff, and join links", href: "/facility", primary: false },
                ].map((n) => (
                  <Link
                    key={n.label}
                    href={n.href}
                    className={`rounded-xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-panel ${
                      n.primary ? "border-navy bg-navy text-white" : "border-gray-muted bg-white"
                    }`}
                  >
                    <p className={`font-semibold ${n.primary ? "text-white" : "text-navy"}`}>{n.label}</p>
                    <p className={`mt-1 text-xs ${n.primary ? "text-white/70" : "text-slate/60"}`}>{n.desc}</p>
                  </Link>
                ))}
              </div>

              {/* Add staff/patient invite links */}
              <div className="rounded-xl border border-gray-muted bg-white p-5 shadow-soft">
                <h3 className="text-sm font-semibold text-navy">Invite to facility</h3>
                <p className="mt-0.5 text-xs text-slate/60">Share these links to add staff or connect patient rooms.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InviteLink
                    label="Staff / nurse"
                    href={`/join?code=${ws.facility.facilityCode}&role=nurse`}
                  />
                  <InviteLink
                    label="Patient room"
                    href={`/join?code=${ws.facility.facilityCode}&role=patient`}
                  />
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

function InviteLink({ label, href }: { label: string; href: string }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${href}` : href;

  function copy() {
    navigator.clipboard.writeText(fullUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-muted bg-offwhite px-4 py-3">
      <div>
        <p className="text-xs font-medium text-slate">{label}</p>
        <p className="mt-0.5 max-w-[200px] truncate font-mono text-xs text-slate/50">{fullUrl}</p>
      </div>
      <button
        onClick={copy}
        className="ml-3 shrink-0 rounded-md border border-gray-muted bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-offwhite"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
