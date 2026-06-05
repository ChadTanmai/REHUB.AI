"use client";

import type { Request, Status } from "@/lib/types";
import { sortQueue } from "@/lib/requestUtils";
import RequestRow from "./RequestRow";

/**
 * The active request queue. Sorts by priority then by display score (which
 * folds in time-waiting and the repeated-request bonus), then by longest wait.
 */

export default function RequestQueue({
  requests,
  now,
  selectedId,
  onSelect,
  onTransition,
  onAssign,
}: {
  requests: Request[];
  now: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTransition: (id: string, to: Status) => void;
  onAssign: (id: string) => void;
}) {
  const sorted = sortQueue(requests, now);

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-muted bg-white p-8 text-center text-sm text-slate/60">
        No active requests. The queue is clear.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((r) => (
        <RequestRow
          key={r.id}
          request={r}
          now={now}
          selected={selectedId === r.id}
          onSelect={() => onSelect(r.id)}
          onTransition={(to) => onTransition(r.id, to)}
          onAssign={() => onAssign(r.id)}
        />
      ))}
    </div>
  );
}
