/**
 * React bindings for the Rehub store.
 *
 * Components subscribe to the store version via useSyncExternalStore, so any
 * mutation — local or arriving over BroadcastChannel from another device —
 * re-renders every connected view. This is the live-sync layer in action.
 */

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
// useEffect/useState retained for useNow below.
import { getStore } from "./store";
import { subscribeToFacility } from "./supabase";
import type { FacilityWorkspace } from "./types";
import { DEMO_FACILITY } from "./mockData";

/** Re-renders whenever the store changes (locally or via realtime fan-out). */
export function useStoreVersion(): number {
  const store = getStore();
  return useSyncExternalStore(
    store.subscribe,
    store.getVersion,
    () => 0, // server snapshot
  );
}

const emptySubscribe = () => () => {};

/**
 * True only after the component has mounted on the client.
 * Implemented with useSyncExternalStore (server snapshot = false, client = true)
 * so there is no setState-in-effect and no hydration mismatch.
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
 * Re-renders on every store change — local (BroadcastChannel) and remote
 * (Supabase Realtime when configured).
 */
export function useWorkspace(
  facilityId: string = DEMO_FACILITY.id,
): FacilityWorkspace {
  useStoreVersion();
  const store = getStore();

  // When Supabase is configured, subscribe to remote updates and reload the
  // workspace into the local store so BroadcastChannel fans it to all tabs.
  useEffect(() => {
    const unsub = subscribeToFacility(facilityId, () => {
      store.ensureFacility(facilityId);
    });
    return unsub;
  }, [facilityId, store]);

  return store.getWorkspace(facilityId);
}

/**
 * A ticking clock for live "waiting time" displays.
 * Defaults to a 15s cadence — frequent enough for a care queue, light on CPU.
 */
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
