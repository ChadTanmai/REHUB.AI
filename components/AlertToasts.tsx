"use client";

import { useEffect, useRef, useState } from "react";
import type { Priority, Request } from "@/lib/types";

/**
 * Transient arrival toasts. Watches the request list and pops a toast when a
 * new request appears:
 *   - Routine   → small toast
 *   - Important → stronger banner-style toast
 *   - Urgent    → coral toast (the persistent strip handles ongoing visibility)
 * No sound in the MVP.
 */

interface Toast {
  id: string;
  priority: Priority;
  title: string;
  detail: string;
}

const TONE: Record<Priority, string> = {
  Urgent: "border-coral/40 bg-white",
  Important: "border-amber/50 bg-white",
  Routine: "border-gray-muted bg-white",
};

const DOT: Record<Priority, string> = {
  Urgent: "bg-coral",
  Important: "bg-amber",
  Routine: "bg-teal",
};

export default function AlertToasts({ requests }: { requests: Request[] }) {
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    // First pass: record existing requests without firing toasts.
    if (seen.current === null) {
      seen.current = new Set(requests.map((r) => r.id));
      return;
    }
    const fresh = requests.filter((r) => !seen.current!.has(r.id));
    if (fresh.length === 0) return;

    fresh.forEach((r) => seen.current!.add(r.id));
    const newToasts: Toast[] = fresh.map((r) => ({
      id: r.id,
      priority: r.priority,
      title:
        r.priority === "Urgent"
          ? `Urgent request from Room ${r.roomNumber}`
          : r.priority === "Important"
            ? `New important request from Room ${r.roomNumber}`
            : `New request from Room ${r.roomNumber}`,
      detail: `${r.requestType} · ${r.source}`,
    }));

    setToasts((prev) => [...newToasts, ...prev].slice(0, 4));

    const timers = newToasts.map((t) =>
      setTimeout(
        () => setToasts((prev) => prev.filter((x) => x.id !== t.id)),
        t.priority === "Urgent" ? 8000 : t.priority === "Important" ? 6000 : 4000,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [requests]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rehub-rise pointer-events-auto rounded-lg border-l-4 ${TONE[t.priority]} border border-gray-muted p-3 shadow-panel`}
        >
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${DOT[t.priority]}`} />
            <p className="text-sm font-semibold text-navy">{t.title}</p>
          </div>
          <p className="mt-0.5 pl-4 text-xs text-slate/70">{t.detail}</p>
        </div>
      ))}
    </div>
  );
}
