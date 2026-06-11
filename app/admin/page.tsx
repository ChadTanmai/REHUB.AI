"use client";

import { SiteNav, SiteFooter } from "@/components/SiteNav";
import AdminAnalytics from "@/components/AdminAnalytics";
import { DEMO_FACILITY } from "@/lib/mockData";
import { useMounted, useWorkspace } from "@/lib/useRehub";

export default function AdminPage() {
  const mounted = useMounted();
  const workspace = useWorkspace(DEMO_FACILITY.id);

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <header>
            <h1 className="text-2xl font-bold text-navy">Admin Analytics</h1>
            <p className="mt-1 text-slate">
              Understand response trends, care workflow patterns, and request
              volume.
            </p>
          </header>

          <div className="mt-6">
            {mounted ? (
              <AdminAnalytics requests={workspace.requests} />
            ) : (
              <div className="h-96 animate-pulse rounded-xl border border-gray-muted bg-white" />
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
