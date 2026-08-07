"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps every screen on the current build without anyone walking around
 * refreshing tablets.
 *
 * IMPORTANT distinction: patient request *data* already updates live
 * (Supabase Realtime + polling in GlobalCommandCenter). This solves the other
 * half — after a deploy, a browser keeps running the OLD JavaScript until it
 * reloads. On this app that's a safety issue, not a cosmetic one: a tablet on
 * yesterday's bundle is running yesterday's triage engine.
 *
 * Reload policy is deliberately different per screen, because yanking the page
 * out from under someone mid-task is its own hazard:
 *
 *   • Room tablets (kiosks, `aggressive`) — reload as soon as a new build is
 *     seen AND the patient isn't mid-request. Nobody is watching these.
 *   • Staff dashboards (default) — never interrupt. Reload silently only while
 *     the tab is hidden/backgrounded; if it's in the foreground, show an
 *     unobtrusive banner and let the nurse pick the moment.
 */

const POLL_MS = 60_000;

export default function AutoUpdater({
  mode = "prompt",
  busy = false,
}: {
  /** "aggressive" = reload when idle (room tablets). "prompt" = banner (staff). */
  mode?: "aggressive" | "prompt";
  /** True while the user is mid-task; suppresses any automatic reload. */
  busy?: boolean;
}) {
  const [updateReady, setUpdateReady] = useState(false);
  const baseline = useRef<string | null>(null);
  // Mirrored into a ref so the reload timers below always read the CURRENT
  // busy state without needing to be torn down and re-armed on every change.
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const d = await r.json();
        const build = String(d?.build ?? "");
        if (!alive || !build || build === "dev") return;

        if (baseline.current === null) {
          baseline.current = build;     // first sight — remember, don't reload
          return;
        }
        if (build !== baseline.current) {
          if (!alive) return;
          setUpdateReady(true);
        }
      } catch { /* offline / transient — try again next tick */ }
    }

    check();
    const id = setInterval(check, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Decide when it's safe to actually reload.
  useEffect(() => {
    if (!updateReady) return;

    const attempt = () => {
      if (busyRef.current) return;                  // never interrupt a task
      if (mode === "aggressive") { window.location.reload(); return; }
      if (document.visibilityState === "hidden") window.location.reload();
    };

    attempt();
    document.addEventListener("visibilitychange", attempt);
    const id = setInterval(attempt, 15_000);
    return () => {
      document.removeEventListener("visibilitychange", attempt);
      clearInterval(id);
    };
  }, [updateReady, mode]);

  if (!updateReady || mode === "aggressive") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[95] -translate-x-1/2 px-4">
      <div className="flex items-center gap-3 rounded-xl border border-teal/30 bg-white px-4 py-3 shadow-panel">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-teal/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
        </span>
        <span className="text-sm font-medium text-navy">A Rehub update is ready.</span>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0c2030]"
        >
          Update now
        </button>
      </div>
    </div>
  );
}
