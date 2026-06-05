"use client";

import type { Request } from "@/lib/types";
import { formatWaiting, waitingMinutes } from "@/lib/requestUtils";

/**
 * Persistent horizontal strip of urgent, not-yet-acknowledged requests.
 * Stays visible until each urgent request is acknowledged. Calm coral, no alarm.
 */

export default function PriorityAlertStrip({
  requests,
  now,
  onAcknowledge,
  onSelect,
}: {
  requests: Request[];
  now: number;
  onAcknowledge: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const urgent = requests.filter(
    (r) => r.priority === "Urgent" && r.status === "New",
  );

  if (urgent.length === 0) return null;

  return (
    <div className="rehub-urgent rounded-xl border-2 border-coral/60 bg-coral/6 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-coral" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-coral">
          Urgent — needs acknowledgement ({urgent.length})
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {urgent.map((r) => (
          <div
            key={r.id}
            onClick={() => onSelect(r.id)}
            className="min-w-[280px] flex-1 cursor-pointer rounded-lg border border-coral/30 bg-white p-3 shadow-soft"
          >
            <p className="text-sm font-semibold text-navy">
              URGENT — Room {r.roomNumber} — {r.requestType}
            </p>
            <p className="text-xs text-slate/70">
              Waiting {formatWaiting(waitingMinutes(r, now))}
            </p>
            <p className="mt-1.5 line-clamp-2 text-sm text-slate/80">
              {r.aiSummary}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(r.id);
              }}
              className="mt-2 w-full rounded-md bg-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#c64e41]"
            >
              Acknowledge
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
