"use client";

/**
 * Cross-network facility lookup for the join flow.
 *
 * Tries localStorage first (instant, same device). Falls back to Supabase via
 * a public security-definer RPC that returns the facility AND its rooms, so a
 * patient on a different phone/network sees the same rooms the admin created.
 *
 * This is what makes the join system work like Kahoot — the code works from
 * any device, anywhere.
 */

import { getStore } from "@/lib/store";
import { lookupFacilityWithRooms } from "@/lib/supabase/facilities";
import { SUPABASE_ENABLED } from "@/lib/supabase";

export interface FacilityLookupResult {
  facilityId: string;
  facilityName: string;
  facilityCode: string;
  teamName: string | null;
  source: "local" | "supabase";
}

export async function lookupFacilityByCode(
  code: string,
): Promise<FacilityLookupResult | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const store = getStore();
  const localId = store.facilityIdForCode(normalized);

  // Whenever Supabase is configured, it's the source of truth — a room
  // added on one device (or even earlier on this same one, before a page
  // reload) must show up here. A stale local cache from a previous visit
  // used to short-circuit this and return outdated rooms forever, no
  // matter how many times the code was re-entered. Local lookup is now
  // only the fallback when Supabase is unavailable or the fetch fails.
  if (SUPABASE_ENABLED) {
    try {
      const remote = await lookupFacilityWithRooms(normalized);
      if (remote) {
        // Seed/refresh the local workspace with the EXACT remote ids so
        // room selection and the room screen line up across devices.
        store.seedRemoteFacility({
          id: remote.id,
          name: remote.name,
          facilityCode: remote.facilityCode,
          teamName: remote.teamName,
          rooms: remote.rooms,
        });
        return {
          facilityId: remote.id,
          facilityName: remote.name,
          facilityCode: remote.facilityCode,
          teamName: remote.teamName,
          source: "supabase",
        };
      }
    } catch { /* fall through to local, if any */ }
  }

  // Local-only fallback: Supabase disabled, unreachable, or found nothing.
  if (localId) {
    const ws = store.getWorkspace(localId);
    return {
      facilityId: localId,
      facilityName: ws.facility.name,
      facilityCode: ws.facility.facilityCode,
      teamName: ws.facility.teamName ?? null,
      source: "local",
    };
  }

  return null;
}
