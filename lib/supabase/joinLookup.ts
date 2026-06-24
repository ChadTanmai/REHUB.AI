"use client";

/**
 * Cross-network facility lookup for the join flow.
 *
 * Tries localStorage first (instant, same device).
 * Falls back to Supabase (works on any device, any network).
 *
 * This is what makes the join system work like Kahoot — the code
 * works from any phone, tablet, or computer anywhere in the world.
 */

import { getAuthClient } from "@/lib/auth/supabase-browser";
import { getStore } from "@/lib/store";

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

  // 1. Check localStorage (same device / same WiFi)
  const localId = getStore().facilityIdForCode(normalized);
  if (localId) {
    const ws = getStore().getWorkspace(localId);
    return {
      facilityId: localId,
      facilityName: ws.facility.name,
      facilityCode: ws.facility.facilityCode,
      teamName: ws.facility.teamName ?? null,
      source: "local",
    };
  }

  // 2. Check Supabase (cross-network, any device)
  try {
    const supabase = getAuthClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("public_lookup_facility", {
      code: normalized,
    });
    if (error || !data) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    if (!row?.id) return null;

    // Seed a thin workspace in localStorage so subsequent lookups are instant
    const store = getStore();
    store.createFacility({
      name: row.name,
      facilityCode: row.facility_code,
      roomCount: 0,
      teamName: row.team_name ?? "Care Team",
    });

    // Now retrieve from store (createFacility returns with the id)
    const seededId = store.facilityIdForCode(row.facility_code);
    if (!seededId) return null;

    return {
      facilityId: seededId,
      facilityName: row.name,
      facilityCode: row.facility_code,
      teamName: row.team_name ?? null,
      source: "supabase",
    };
  } catch {
    return null;
  }
}
