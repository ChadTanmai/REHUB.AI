"use client";

import { useEffect, useState } from "react";
import { RehubMark } from "./RehubLogo";

/**
 * Staged verification checklist shown while a Handoff Brief compiles.
 * Steps auto-advance on a fixed cadence rather than tracking the real async
 * call — the point is to make waiting feel active and trustworthy, the same
 * way a skeleton loader smooths a fast response. generateReport() races this
 * against a minimum display time so it never flashes for a fraction of a
 * second on a fast AI response.
 */

const STEPS = [
  "Gathering this shift's requests",
  "Reviewing critical & high-priority events",
  "Calculating response times",
  "Drafting the handoff narrative",
];

export default function HandoffBriefLoading() {
  const [done, setDone] = useState(0);

  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setDone((d) => Math.max(d, i + 1)), 260 + i * 300),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inline-flex h-16 w-16 animate-ping rounded-full bg-teal/20" />
        <RehubMark size={40} animated />
      </div>

      <div className="w-full max-w-xs space-y-2.5">
        {STEPS.map((label, i) => {
          const isDone = i < done;
          return (
            <div key={label} className="flex items-center gap-2.5 text-sm">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                  isDone ? "border-success bg-success" : "border-gray-muted"
                }`}
              >
                {isDone && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span className={isDone ? "font-medium text-navy" : "text-slate/50"}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
