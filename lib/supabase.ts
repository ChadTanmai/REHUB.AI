/**
 * Supabase client + feature flag.
 *
 * The app runs in two modes:
 *   - LOCAL (default): localStorage + BroadcastChannel — no backend required.
 *   - SUPABASE: when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 *     are set, all reads/writes go through Supabase and realtime subscriptions
 *     provide live cross-device sync.
 *
 * Call sites use lib/db.ts (the repository layer) — they never touch the
 * client directly, so swapping backends doesn't ripple through the app.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let _client: SupabaseClient<Database> | null = null;

/** Returns the shared Supabase client, or throws if Supabase is not configured. */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!SUPABASE_ENABLED) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  if (!_client) {
    _client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return _client;
}

/**
 * Subscribe to live changes in a facility's request queue.
 * Calls `onUpdate` whenever a request is inserted or updated.
 * Returns an unsubscribe function.
 *
 * In local mode this is a no-op (BroadcastChannel handles it).
 */
export function subscribeToFacility(
  facilityId: string,
  onUpdate: () => void,
): () => void {
  if (!SUPABASE_ENABLED) return () => {};

  const client = getSupabaseClient();
  const channel = client
    .channel(`facility:${facilityId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "requests",
        filter: `facility_id=eq.${facilityId}`,
      },
      onUpdate,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "request_events",
        filter: `facility_id=eq.${facilityId}`,
      },
      onUpdate,
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
