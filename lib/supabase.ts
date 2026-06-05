/**
 * Supabase integration — documented, not wired up in the MVP.
 *
 * The MVP runs entirely on the local store (lib/store.ts) so it demos with no
 * backend, no keys, and no patient data leaving the device. This file marks the
 * single seam where production realtime plugs in.
 *
 * Planned production model
 * ------------------------
 *  Tables: facilities, rooms, therapists, requests, request_events,
 *          ai_classifications, device_sessions
 *
 *  Realtime: subscribe to the `requests` and `request_events` tables filtered
 *  by `facility_id`. Every room screen and therapist dashboard joins the same
 *  facility channel, so an insert/update fans out to all connected devices —
 *  exactly what BroadcastChannel emulates today.
 *
 *  Auth: Supabase Auth with role-based access (room device, therapist, admin),
 *  facility-scoped row-level security, and an audit log built from
 *  request_events. See docs/privacy_notes.md.
 *
 * To enable later:
 *   1. npm install @supabase/supabase-js
 *   2. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   3. Implement createSupabaseClient() and subscribeToFacility() below
 *   4. Have lib/store.ts persist/broadcast through Supabase instead of
 *      localStorage + BroadcastChannel. Call sites do not change.
 */

export const SUPABASE_ENABLED =
  typeof process !== "undefined" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

/**
 * Sketch of the realtime subscription the store would use in production.
 * Intentionally a no-op in MVP.
 */
export interface FacilityChannel {
  unsubscribe: () => void;
}

export function subscribeToFacility(
  _facilityId: string,
  _onChange: () => void,
): FacilityChannel {
  // No-op in MVP. Replace with a Supabase channel:
  //   supabase.channel(`facility:${facilityId}`)
  //     .on('postgres_changes',
  //         { event: '*', schema: 'public', table: 'requests',
  //           filter: `facility_id=eq.${facilityId}` }, onChange)
  //     .subscribe()
  return { unsubscribe: () => {} };
}
