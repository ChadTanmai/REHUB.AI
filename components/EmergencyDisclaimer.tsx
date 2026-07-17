"use client";

import { useState } from "react";

/**
 * One-time, acknowledgment-gated safety disclaimer shown before a resident's
 * first interaction with a room screen. Reassuring tone, not alarming — the
 * app's positioning throughout is "communication tool, not an emergency
 * system" (see SafetyNote.tsx and README's safety positioning section); this
 * is the single upfront moment that states it plainly and requires assent.
 */

const STORAGE_PREFIX = "rehub:disclaimer-ack:";

export function hasAcknowledgedDisclaimer(roomId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${roomId}`) === "1";
  } catch {
    return true;
  }
}

function acknowledge(roomId: string) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${roomId}`, "1");
  } catch {
    /* storage unavailable — the modal will just reappear next visit */
  }
}

export default function EmergencyDisclaimer({
  roomId,
  onAcknowledge,
}: {
  roomId: string;
  onAcknowledge: () => void;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-gray-muted bg-white p-6 shadow-panel">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-mint text-teal">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h2 className="text-center text-lg font-bold text-navy">Before you start</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate">
          Rehub helps communicate non-emergency requests to your care team and helps
          staff organize patient needs more efficiently. It is not an emergency
          response system and does not guarantee an immediate response.
        </p>
        <p className="mt-3 rounded-lg border border-coral/30 bg-coral/8 p-3 text-sm leading-relaxed text-navy">
          If you are experiencing a medical emergency — severe pain, difficulty
          breathing, chest pain, loss of consciousness, or any life-threatening
          condition — immediately use your facility&apos;s emergency call system or
          notify nearby staff.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate/70">
          By continuing, you acknowledge this app is intended to improve
          communication and never replaces emergency procedures.
        </p>

        <label className="mt-4 flex items-start gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-muted text-teal focus:ring-teal"
          />
          I understand and I&apos;m ready to continue.
        </label>

        <button
          type="button"
          disabled={!checked}
          onClick={() => {
            acknowledge(roomId);
            onAcknowledge();
          }}
          className="mt-5 min-h-[52px] w-full rounded-xl bg-teal px-5 text-base font-semibold text-white transition-colors hover:bg-[#2a8d8d] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
