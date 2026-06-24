"use client";

/**
 * /join/MAPLE-01 — QR codes, links, and share buttons point here.
 * Pre-populates the code and drops the user straight into the room-selection step.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RehubWordmark } from "@/components/RehubLogo";
import { lookupFacilityByCode, type FacilityLookupResult } from "@/lib/supabase/joinLookup";
import { normalizeFacilityCode } from "@/lib/security";
import { useMounted } from "@/lib/useRehub";

function JoinCodeInner() {
  const params = useParams<{ code: string }>();
  const mounted = useMounted();
  const rawCode = normalizeFacilityCode(decodeURIComponent(params.code ?? ""));

  useEffect(() => {
    if (!mounted || !rawCode) return;
    // Just redirect to the main join page with the code pre-filled —
    // all join logic (room selection, name, loading) lives there.
    window.location.replace(`/join?code=${encodeURIComponent(rawCode)}`);
  }, [mounted, rawCode]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-offwhite px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <Link href="/"><RehubWordmark /></Link>
        </div>
        <div className="rounded-2xl border border-gray-muted bg-white p-8 shadow-panel">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-teal border-t-transparent" />
          <p className="mt-4 font-semibold text-navy">Connecting…</p>
          <p className="mt-1 text-sm text-slate/60">
            Code <span className="font-mono font-bold">{rawCode}</span>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function JoinCodePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-offwhite">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      </div>
    }>
      <JoinCodeInner />
    </Suspense>
  );
}
