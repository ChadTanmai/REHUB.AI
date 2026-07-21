"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteNav";
import AdminAnalytics from "@/components/AdminAnalytics";
import EmptyState from "@/components/EmptyState";
import { getStore } from "@/lib/store";
import { getTherapistSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";
import { useAuth } from "@/lib/auth/AuthProvider";

function ChartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

export default function AdminPage() {
  const mounted = useMounted();
  const router = useRouter();
  const { profile } = useAuth();
  useStoreVersion();

  const store = getStore();
  const session = mounted ? getTherapistSession() : null;
  // Same resolution as /dashboard, /command, /facility: fall back to the
  // signed-in account's own facility when there's no paired therapist device
  // session on this browser.
  const facilityId =
    mounted && session && store.ownsFacility(session.facilityId)
      ? session.facilityId
      : mounted && store.ownsFacility(profile?.facilityId)
        ? profile!.facilityId!
        : mounted ? store.listFacilities()[0]?.id ?? null : null;

  useEffect(() => {
    if (!mounted) return;
    if (!facilityId) router.replace("/dashboard");
  }, [mounted, facilityId, router]);

  if (!mounted) {
    return (
      <>
        <AppNav />
        <main className="flex-1 bg-offwhite" />
      </>
    );
  }

  if (!facilityId) return null;

  const ws = getStore().getWorkspace(facilityId);

  return (
    <>
      <AppNav facilityName={ws.facility.name} />
      <main className="flex-1 bg-offwhite">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-6 rounded-xl border border-gray-muted bg-white p-4 shadow-soft sm:p-5">
            <h1 className="text-xl font-bold text-navy">Analytics</h1>
            <p className="mt-0.5 text-sm text-slate/70">
              {ws.facility.name} · Response trends and workflow metrics
            </p>
          </div>

          {ws.requests.length === 0 ? (
            <EmptyState
              icon={<ChartIcon />}
              title="No data yet"
              description="Analytics will appear here once your care team starts receiving and resolving requests."
              action={{ label: "Go to dashboard", href: "/therapist" }}
            />
          ) : (
            <AdminAnalytics requests={ws.requests} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
