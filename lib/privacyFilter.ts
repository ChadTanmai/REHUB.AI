/**
 * Rule-based redaction for structured personal identifiers in free-text
 * request transcripts, applied before a transcript is stored or sent to any
 * AI provider.
 *
 * Honest scope: this is regex/pattern matching against structured
 * identifiers (phone numbers, emails, SSNs, card numbers, street addresses,
 * date-of-birth-shaped dates) — it is NOT a named-entity-recognition model,
 * so it will not catch a spoken name on its own ("my name is John"). It
 * exists to stop the common, high-confidence leaks: someone reading a phone
 * number, email, or SSN out loud to be transcribed verbatim into a request
 * that staff (and, if AI triage is enabled, a third-party model) will read.
 */

interface Rule {
  label: string;
  pattern: RegExp;
}

const RULES: Rule[] = [
  { label: "SSN Removed", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    label: "Card Number Removed",
    pattern: /\b(?:\d[ -]?){13,16}\b/g,
  },
  {
    label: "Email Removed",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    label: "Phone Removed",
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  {
    label: "Date of Birth Removed",
    pattern: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:\d{2}|\d{4})\b/g,
  },
  {
    label: "Address Removed",
    pattern:
      /\b\d{1,6}\s+[A-Za-z0-9.'\s]{2,40}\b(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl)\b\.?/gi,
  },
];

/**
 * Replace structured PII/PHI-shaped substrings with a neutral placeholder.
 * Order matters: card numbers must run before phone numbers since a 16-digit
 * run would otherwise partially match the phone pattern.
 */
export function redactPHI(text: string): string {
  if (!text) return text;
  let result = text;
  for (const rule of RULES) {
    result = result.replace(rule.pattern, `[${rule.label}]`);
  }
  return result;
}

/** True if redaction changed the text — useful for audit/logging without storing the original. */
export function containsLikelyPHI(text: string): boolean {
  return redactPHI(text) !== text;
}
