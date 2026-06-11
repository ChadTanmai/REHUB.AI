/**
 * Import the national rehabilitation facility directory into Supabase.
 *
 * Usage (run once after schema is applied):
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
 *   node scripts/import-directory.mjs
 *
 * Uses the service-role key (bypasses RLS) since this is a one-time admin
 * operation — never expose the service key in the browser or in env vars
 * accessible to client code.
 *
 * The script is idempotent: it upserts on `ccn` primary key, so re-running
 * is safe.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const filePath = join(__dirname, "../lib/data/facilityDirectory.json");
const facilities = JSON.parse(readFileSync(filePath, "utf8"));

console.log(`Importing ${facilities.length} facilities…`);

const BATCH = 250;
let inserted = 0;

for (let i = 0; i < facilities.length; i += BATCH) {
  const batch = facilities.slice(i, i + BATCH).map((f) => ({
    ccn: f.ccn,
    name: f.name,
    address: f.address || null,
    city: f.city || null,
    state: f.state || null,
    zip: f.zip || null,
    county: f.county || null,
    phone: f.phone || null,
    ownership: f.ownership || null,
  }));

  const { error } = await supabase
    .from("facility_directory")
    .upsert(batch, { onConflict: "ccn" });

  if (error) {
    console.error(`Batch ${i / BATCH + 1} failed:`, error.message);
    process.exit(1);
  }
  inserted += batch.length;
  console.log(`  ${inserted}/${facilities.length}`);
}

console.log(`\n✓ Imported ${inserted} facilities into facility_directory.`);
