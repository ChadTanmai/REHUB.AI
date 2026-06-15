/**
 * Cross-device WiFi sync layer.
 *
 * Pushes workspace snapshots to /api/sync after every local mutation,
 * and subscribes to SSE updates so remote mutations are received.
 *
 * Works automatically on the local network — no configuration needed.
 * Falls back silently if the server is unreachable (e.g. offline, Supabase
 * configured instead).
 */

"use client";

import { SUPABASE_ENABLED } from "./supabase";

// Don't run network sync if Supabase is handling it.
const ENABLED = !SUPABASE_ENABLED;

/**
 * POST the current workspace snapshot to the sync server.
 * Fire-and-forget — never blocks the UI.
 */
export function pushSnapshot(facilityId: string, workspace: unknown): void {
  if (!ENABLED || typeof window === "undefined") return;
  fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ facilityId, workspace }),
  }).catch(() => {});
}

export interface SyncSubscription {
  close: () => void;
}

/**
 * Subscribe to SSE updates for a facility.
 * `onUpdate` receives a fresh workspace snapshot (parsed JSON) whenever any
 * device on the network pushes one.
 */
export function subscribeToNetworkSync(
  facilityId: string,
  onUpdate: (workspace: unknown) => void,
): SyncSubscription {
  if (!ENABLED || typeof window === "undefined" || typeof EventSource === "undefined") {
    return { close: () => {} };
  }

  const url = `/api/sync?facilityId=${encodeURIComponent(facilityId)}`;
  const es = new EventSource(url);
  let closed = false;

  es.onmessage = (e) => {
    if (closed) return;
    const data = e.data as string;
    if (data === "connected" || !data) return;
    try {
      const ws = JSON.parse(data);
      if (ws && typeof ws === "object") onUpdate(ws);
    } catch {
      // ignore malformed events
    }
  };

  es.onerror = () => {
    if (!closed) {
      // Reconnect automatically — EventSource handles this natively.
    }
  };

  return {
    close: () => {
      closed = true;
      es.close();
    },
  };
}
