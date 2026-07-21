/**
 * A clinician's personal "working session" — a browser-local time boundary,
 * NOT a copy of any shared facility data. lib/analyticsUtils.ts's
 * computeSessionStats() always re-derives the personal numbers (my requests
 * handled, my avg response, ...) fresh from the same shared request list,
 * windowed by this record's `startedAt`. Resetting a session only moves that
 * timestamp forward — it never mutates, duplicates, or resets anything
 * shared (Operations KPIs, the request queue, historical data all stay
 * exactly as they are for every other signed-in clinician).
 */

"use client";

const KEY_PREFIX = "rehub:clinician-session:";

export interface ClinicianSession {
  startedAt: string;
  facilityId: string;
}

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function getSession(userId: string): ClinicianSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as ClinicianSession) : null;
  } catch {
    return null;
  }
}

export function hasSession(userId: string): boolean {
  return getSession(userId) !== null;
}

/** Starts (or restarts) the session — the only thing "Start New Session" does. */
export function startSession(userId: string, facilityId: string): ClinicianSession {
  const session: ClinicianSession = { startedAt: new Date().toISOString(), facilityId };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(key(userId), JSON.stringify(session));
    } catch {
      /* ignore — worst case the welcome gate reappears next load */
    }
  }
  return session;
}
