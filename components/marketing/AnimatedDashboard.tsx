"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EASE } from "./motion";

/**
 * A self-contained, looping mock of the live request queue for the hero.
 * Rows arrive one at a time and a status quietly advances — conveying
 * "real-time" without being noisy. Purely decorative.
 */

interface Row {
  room: string;
  name: string;
  type: string;
  tone: "coral" | "amber" | "teal";
  label: string;
  wait: string;
}

const ROWS: Row[] = [
  { room: "204", name: "Margaret", type: "Pain + Mobility", tone: "coral", label: "Urgent", wait: "now" },
  { room: "118", name: "Robert", type: "Bathroom", tone: "amber", label: "Important", wait: "1 min" },
  { room: "102", name: "Frances", type: "Water", tone: "teal", label: "Routine", wait: "2 min" },
  { room: "110", name: "Dorothy", type: "Medication", tone: "amber", label: "Important", wait: "3 min" },
];

const TONE = {
  coral: { border: "border-l-coral", chip: "bg-coral/12 text-coral", dot: "bg-coral" },
  amber: { border: "border-l-amber", chip: "bg-amber/15 text-[#9a6b00]", dot: "bg-amber" },
  teal: { border: "border-l-teal", chip: "bg-teal/10 text-teal", dot: "bg-teal" },
};

export default function AnimatedDashboard() {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => (c >= ROWS.length ? 1 : c + 1));
    }, 1600);
    return () => clearInterval(id);
  }, []);

  const visible = ROWS.slice(0, count);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
      className="rounded-2xl border border-gray-muted bg-white p-4 shadow-panel sm:p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-navy">Therapist Dashboard</p>
          <p className="text-xs text-slate/60">Maplewood Care Team</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-md bg-mint px-2 py-1 text-xs font-medium text-teal">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-teal"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          Live
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        <AnimatePresence mode="popLayout">
          {visible.map((r) => {
            const t = TONE[r.tone];
            return (
              <motion.div
                key={r.room}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.45, ease: EASE }}
                className={`rounded-lg border border-gray-muted border-l-4 ${t.border} bg-offwhite px-3 py-2.5`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-navy">
                    Room {r.room} · {r.name}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${t.chip}`}>
                    {r.label}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-xs text-slate/70">
                  <span>{r.type}</span>
                  <span>Waiting {r.wait}</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-muted pt-3 text-xs text-slate/55">
        <span>{visible.length} active requests</span>
        <span>Avg response 4.2 min</span>
      </div>
    </motion.div>
  );
}
