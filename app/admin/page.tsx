"use client";

import AppNav from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteNav";
import AdminAnalytics from "@/components/AdminAnalytics";
import { DEMO_FACILITY } from "@/lib/mockData";
import { getStore } from "@/lib/store";
import { getTherapistSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";

export default function AdminPage() {
  const mounted = useMounted();
  useStoreVersion();

  if (!mounted) {
    return (
      <>
        <AppNav />
        <main className="flex-1 bg-offwhite" />
      </>
    );
  }

  const session = getTherapistSession();
  const facilityId = session?.facilityId ?? DEMO_FACILITY.id;
  const workspace = getStore().getWorkspace(facilityId);

  return (
    <>
      <AppNav facilityName={workspace.facility.name} userName={session?.name} />
      <main className="flex-1 bg-offwhite">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-6 rounded-xl border border-gray-muted bg-white p-4 shadow-soft sm:p-5">
            <h1 className="text-xl font-bold text-navy">Analytics</h1>
            <p className="mt-0.5 text-sm text-slate/70">
              {workspace.facility.name} · Response trends, request volume, and workflow metrics
            </p>
          </div>
          <AdminAnalytics requests={workspace.requests} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
