"use client";

/**
 * Enterprise safety guard.
 *
 * When the app is deployed WITHOUT a database (Supabase env vars missing), it
 * falls back to per-device localStorage — patient requests are not durably
 * saved and do not sync across devices. In production that is a data-loss and
 * patient-safety risk, so we surface a loud, unmissable banner on every
 * data-bearing screen until the backend is connected.
 *
 * It never shows on marketing pages, and never shows once Supabase is
 * configured — so a correctly-deployed enterprise instance is unaffected.
 */

import { usePathname } from "next/navigation";

const BACKEND_CONNECTED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// Screens where real facility/patient data flows and must persist.
const DATA_ROUTES = [
  "/dashboard", "/therapist", "/admin", "/facility", "/rooms",
  "/onboarding", "/setup", "/patient", "/room", "/join",
  "/account", "/diagnostics",
];

export default function BackendBanner() {
  const pathname = usePathname() || "/";
  if (BACKEND_CONNECTED) return null;
  if (!DATA_ROUTES.some((p) => pathname.startsWith(p))) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] flex items-center justify-center gap-2 bg-coral px-4 py-2 text-center text-sm font-semibold text-white"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
      <span>
        Database not connected — data is saved on this device only and will not sync or persist. Configure Supabase before going live.
      </span>
    </div>
  );
}
