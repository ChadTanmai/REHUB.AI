"use client";

import { useEffect, useState } from "react";
import { SUPABASE_ENABLED } from "@/lib/supabase";
import { pendingCount } from "@/lib/supabase/outbox";

/**
 * Small always-visible indicator of whether patient requests are actually
 * reaching the cloud. The outbox (lib/supabase/outbox.ts) already retries
 * durably in the background — this just surfaces that state instead of
 * requiring a manual "Publish to Cloud" click.
 */

type SyncState = "synced" | "syncing" | "offline";

function computeState(online: boolean, pending: number): SyncState {
  if (!online) return "offline";
  if (pending > 0) return "syncing";
  return "synced";
}

const META: Record<SyncState, { label: string; dot: string; text: string }> = {
  synced:  { label: "Synced",  dot: "bg-success", text: "text-success" },
  syncing: { label: "Syncing…", dot: "bg-amber animate-pulse", text: "text-amber" },
  offline: { label: "Offline — retrying", dot: "bg-coral animate-pulse", text: "text-coral" },
};

export default function SyncStatus() {
  const [state, setState] = useState<SyncState>("synced");

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;

    function refresh() {
      setState(computeState(navigator.onLine, pendingCount()));
    }

    refresh();
    const interval = setInterval(refresh, 2000);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  if (!SUPABASE_ENABLED) return null;

  const m = META[state];
  return (
    <span className={`hidden items-center gap-1.5 text-xs font-medium sm:flex ${m.text}`} title="Cloud sync status">
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}
