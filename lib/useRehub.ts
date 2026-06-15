/**
 * React bindings for the Rehub store.
 *
 * Components subscribe to the store version via useSyncExternalStore, so any
 * mutation — local (BroadcastChannel) or remote (SSE / Supabase) — re-renders
 * every connected view on every device.
 */

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getStore } from "./store";
import { subscribeToFacility } from "./supabase";
import { subscribeToNetworkSync } from "./networkSync";
import type { FacilityWorkspace } from "./types";
import { DEMO_FACILITY } from "./mockData";

/** Re-renders whenever the store changes (locally or via any realtime source). */
export function useStoreVersion(): number {
  const store = getStore();
  return useSyncExternalStore(
    store.subscribe,
    store.getVersion,
    () => 0,
  );
}

const emptySubscribe = () => () => {};

/**
 * True only after the component has mounted on the client.
 * Uses useSyncExternalStore so there's no hydration mismatch.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Subscribe to a facility workspace.
 *
 * Re-renders on:
 *   1. Local mutations (same device, any tab) via BroadcastChannel
 *   2. Same-WiFi remote updates via SSE (/api/sync)
 *   3. Cross-internet remote updates via Supabase Realtime (when configured)
 */
export function useWorkspace(
  facilityId: string = DEMO_FACILITY.id,
): FacilityWorkspace {
  useStoreVersion();
  const store = getStore();

  // Supabase Realtime (when env vars are set).
  useEffect(() => {
    const unsub = subscribeToFacility(facilityId, () => {
      store.ensureFacility(facilityId);
    });
    return unsub;
  }, [facilityId, store]);

  // WiFi/local-network SSE sync (always active in demo mode).
  useEffect(() => {
    const sub = subscribeToNetworkSync(facilityId, (remoteWorkspace) => {
      // The server sent us a workspace snapshot from another device.
      // Merge it into local storage and trigger a re-render.
      if (remoteWorkspace && typeof remoteWorkspace === "object") {
        try {
          localStorage.setItem(
            `rehub:facility:${facilityId}`,
            JSON.stringify(remoteWorkspace),
          );
        } catch {
          // private mode — in-memory still works
        }
        store.reloadFromStorage(facilityId);
      }
    });
    return () => sub.close();
  }, [facilityId, store]);

  return store.getWorkspace(facilityId);
}

/**
 * A ticking clock for live "waiting time" displays.
 * 15s cadence — frequent enough for a care queue, light on CPU.
 */
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
