/**
 * National rehabilitation facility directory.
 *
 * Source: U.S. Centers for Medicare & Medicaid Services (CMS) public provider
 * dataset "Inpatient Rehabilitation Facility - General Information"
 * (dataset 7t8x-u3ir, data.cms.gov). 1,221 facilities across all states.
 *
 * This powers the onboarding auto-fill: a facility admin types their name and
 * the address/phone fields populate from the real record. The data is public
 * provider information — not patient data.
 *
 * When Supabase is configured, the same records live in the `facility_directory`
 * table and search runs server-side; offline/local mode searches this bundle.
 */

import directory from "./data/facilityDirectory.json";

export interface DirectoryFacility {
  ccn: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  phone: string;
  ownership: string;
}

export const FACILITY_DIRECTORY = directory as DirectoryFacility[];

export const DIRECTORY_COUNT = FACILITY_DIRECTORY.length;

/** Distinct US states/territories present in the directory, sorted. */
export const DIRECTORY_STATES: string[] = Array.from(
  new Set(FACILITY_DIRECTORY.map((f) => f.state)),
).sort();

function score(f: DirectoryFacility, q: string): number {
  const name = f.name.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  const idx = name.indexOf(q);
  if (idx >= 0) return 60 - Math.min(idx, 20);
  // Secondary match on city/state for queries like "rehab dallas".
  if (`${f.city} ${f.state}`.toLowerCase().includes(q)) return 30;
  return -1;
}

/**
 * Search the directory by name (and, loosely, city/state).
 * Returns the best matches up to `limit`. Empty query → [].
 */
export function searchFacilities(
  query: string,
  limit = 8,
  stateFilter?: string,
): DirectoryFacility[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const pool = stateFilter
    ? FACILITY_DIRECTORY.filter((f) => f.state === stateFilter)
    : FACILITY_DIRECTORY;

  return pool
    .map((f) => ({ f, s: score(f, q) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.f.name.localeCompare(b.f.name))
    .slice(0, limit)
    .map((x) => x.f);
}

/** Look up a single facility by its CMS Certification Number. */
export function facilityByCcn(ccn: string): DirectoryFacility | undefined {
  return FACILITY_DIRECTORY.find((f) => f.ccn === ccn);
}

/** Suggest a short facility code from a directory record (deterministic). */
export function suggestCode(f: DirectoryFacility): string {
  const initials = f.name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const zip3 = (f.zip || "").slice(0, 3);
  return `${initials || "REHUB"}-${zip3 || "01"}`;
}
