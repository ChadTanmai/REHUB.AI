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

  // 1. Same device / same browser — instant.
  const localId = store.facilityIdForCode(normalized);
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

  // 2. Any device / any network — Supabase public RPC (facility + rooms).
  try {
    const remote = await lookupFacilityWithRooms(normalized);
    if (!remote) return null;

    // Seed the local workspace with the EXACT remote ids so room selection
    // and the room screen line up across devices.
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
  } catch {
    return null;
  }
}
