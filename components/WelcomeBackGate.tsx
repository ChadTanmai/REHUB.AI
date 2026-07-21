"use client";

import { useState } from "react";
import Link from "next/link";
import { startSession } from "@/lib/clinicianSession";

/**
 * Shown once per browser session (the caller decides when — see
 * app/dashboard/page.tsx) when a clinician returns to a facility they were
 * already working in. Resume is the recommended default: it changes
 * nothing. Start New Session only resets this clinician's personal "my
 * session" numbers (lib/clinicianSession.ts + computeSessionStats) — the
 * shared Operations dashboard and facility data are never touched, and the
 * confirmation step says so explicitly before anything happens.
 */

export default function WelcomeBackGate({
  userId,
  firstName,
  facilityId,
  facilityName,
  onResolved,
}: {
  userId: string;
  firstName: string;
  facilityId: string;
  facilityName: string;
  onResolved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  function resume() {
    onResolved();
  }

  function confirmNewSession() {
    startSession(userId, facilityId);
    onResolved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-gray-muted bg-white p-6 shadow-panel">
        {!confirming ? (
          <>
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-mint text-teal">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 12a9 9 0 0115-6.7M21 12a9 9 0 01-15 6.7" /><path d="M17 2v4h-4M7 22v-4h4" />
              </svg>
            </div>
            <h2 className="text-center text-lg font-bold text-navy">Welcome back, {firstName}.</h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate">
              We found where you left off — <span className="font-semibold text-navy">{facilityName}</span>.
            </p>

            <button
              type="button"
              onClick={resume}
              className="mt-5 min-h-[52px] w-full rounded-xl bg-teal px-5 text-base font-semibold text-white transition-colors hover:bg-[#2a8d8d]"
            >
              Resume previous session
            </button>
            <p className="mt-1.5 text-center text-xs text-slate/50">Recommended — nothing is changed.</p>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 min-h-[48px] w-full rounded-xl border-2 border-navy bg-white px-5 text-sm font-semibold text-navy transition-colors hover:bg-navy/5"
            >
              Start new session
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-navy">Start a new session?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              This resets your personal session numbers only:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate">
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-coral" /> My session duration</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-coral" /> My requests resolved this session</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-coral" /> My session avg. response time</li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-slate">
              These never change — this is shared facility data, seen by every signed-in team member:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate">
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success" /> The Operations dashboard &amp; charts</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success" /> The patient request queue</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Historical reports &amp; facility data</li>
            </ul>

            <Link href="/account/facilities" className="mt-4 block text-center text-xs font-medium text-teal hover:underline">
              Want to switch facilities instead? →
            </Link>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="min-h-[48px] rounded-xl border border-gray-muted bg-white px-5 text-sm font-semibold text-navy hover:bg-offwhite"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmNewSession}
                className="min-h-[48px] rounded-xl bg-navy px-5 text-sm font-semibold text-white hover:bg-[#0c2030]"
              >
                Start new session
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
