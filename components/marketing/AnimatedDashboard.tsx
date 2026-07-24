"use client";

import { motion } from "framer-motion";
import { EASE } from "./motion";

/**
 * A still mock of the live request queue for the hero. Rows reveal once,
 * staggered, when scrolled into view — no infinite loop, so the page does
 * not jump around on mobile. Purely decorative.
 */

interface Row {
  room: string;
  name: string;
  type: string;
  urgent?: boolean;
  label: string;
  wait: string;
}

const ROWS: Row[] = [
  { room: "204", name: "Margaret", type: "Pain + Mobility", urgent: true, label: "Urgent", wait: "now" },
  { room: "118", name: "Robert", type: "Bathroom", label: "Important", wait: "1 min" },
  { room: "102", name: "Frances", type: "Water", label: "Routine", wait: "2 min" },
  { room: "110", name: "Dorothy", type: "Medication", label: "Important", wait: "3 min" },
];

export default function AnimatedDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="rounded-2xl border border-gray-muted bg-white p-4 shadow-panel sm:p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-navy">Care Team Dashboard</p>
          <p className="text-xs text-slate/60">Maplewood Care Team (example)</p>
        </div>
        {/* Deliberately not "Live" + a green dot — this is a static mockup on a
            public marketing page. Names/rooms are fictional, but "Live" plus
            real-looking data would read as an actual patient feed. */}
        <span className="flex items-center gap-1.5 rounded-md bg-offwhite px-2 py-1 text-xs font-medium text-slate/70">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4l2.5 2.5" />
          </svg>
          Sample data
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {ROWS.map((r, i) => (
          <motion.div
            key={r.room}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.2 + i * 0.12 }}
            className={`rounded-lg border border-gray-muted bg-offwhite px-3 py-2.5 ${
              r.urgent ? "border-l-4 border-l-coral" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-navy">
                Room {r.room} · {r.name}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                  r.urgent ? "bg-coral/12 text-coral" : "bg-white text-slate"
                }`}
              >
                {r.label}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-xs text-slate/70">
              <span>{r.type}</span>
              <span>Waiting {r.wait}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-muted pt-3 text-xs text-slate/55">
        <span>4 active requests</span>
        <span>Avg response 4.2 min</span>
      </div>

      <p className="mt-3 text-center text-[11px] text-slate/45">
        Illustrative example — names, rooms, and requests are fictional, not real patient data.
      </p>
    </motion.div>
  );
}
