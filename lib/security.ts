/**
 * Data-handling guardrails for the Rehub demo.
 *
 * Posture (honest, not aspirational):
 *   - No real patient health information is ever collected or stored.
 *   - Nothing leaves the device: no analytics, no external API calls, no voice
 *     data sent off-device. The Web Speech API runs in the browser.
 *   - All state lives in the browser's own localStorage, scoped per facility.
 *   - Free-text input is length-capped and sanitized before storage/display.
 *
 * This file centralizes input hygiene so every entry point is consistent.
 * Production hardening (auth, RLS, encryption at rest, audit logging, signed
 * device registration, compliance review) is documented in docs/privacy_notes.md
 * - it is NOT implemented here, and the app never claims it is.
 */

/** Hard cap on any free-text request to bound storage and rendering. */
export const MAX_REQUEST_LENGTH = 500;

/**
 * Sanitize free-text resident input.
 * Strips control characters and angle brackets (defense-in-depth against
 * injection even though React escapes by default), collapses whitespace, and
 * truncates to a safe length.
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return input
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_REQUEST_LENGTH);
}

/** Sanitize a short display field (names, room numbers). */
export function sanitizeField(input: string, max = 60): string {
  return sanitizeText(input).slice(0, max);
}

/** Normalize a facility code: uppercase, alphanumeric + dash only. */
export function normalizeFacilityCode(input: string): string {
  return (input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

/**
 * Live-format a facility code as the user types, so on a phone they can type
 * the word then the number and the dash auto-inserts: "test01" → "TEST-01".
 * Strips punctuation first, then places a single dash before the first digit
 * run. Codes with no digits (e.g. "MAPLE") are left undashed.
 */
export function formatJoinCodeInput(input: string): string {
  const squashed = (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  const m = squashed.match(/^([A-Z]+)(\d.*)$/);
  return m ? `${m[1]}-${m[2]}` : squashed;
}

/** Reminder string surfaced in setup flows. */
export const DEMO_DATA_NOTICE =
  "Demo mode uses fictional names only. Do not enter real patient information.";
