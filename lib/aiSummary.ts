/**
 * Deterministic AI summaries.
 *
 * Produces two strings from a classified request:
 *   - staffSummary: short, factual, non-diagnostic, explains the classification
 *   - patientConfirmation: reassuring, plain-language confirmation for the resident
 *
 * Hard rule: never diagnose. Summaries restate what the resident said and why
 * the request was prioritized — nothing about a medical condition.
 */

import type { Priority, RequestSource, RequestType } from "./types";

export interface SummaryInput {
  transcript?: string;
  requestType: RequestType;
  priority: Priority;
  detectedKeywords: string[];
  source: RequestSource;
  safetyFlag?: boolean;
}

export interface SummaryOutput {
  staffSummary: string;
  patientConfirmation: string;
}

const NEED_PHRASES: Record<RequestType, string> = {
  Pain: "help with pain",
  Mobility: "help moving or standing",
  Bathroom: "help with the bathroom",
  "Medication Question": "a medication question answered",
  Water: "water",
  Food: "food",
  Help: "help",
  Custom: "assistance",
};

function reasonForPriority(
  priority: Priority,
  type: RequestType,
  keywords: string[],
): string {
  if (priority === "Routine") return "";
  const cues = keywords.length
    ? keywords.slice(0, 3).join(", ")
    : type.toLowerCase();
  if (priority === "Urgent") {
    return ` Classified urgent due to ${cues}.`;
  }
  return ` Classified important due to ${cues}.`;
}

export function buildSummary(input: SummaryInput): SummaryOutput {
  const { transcript, requestType, priority, detectedKeywords, safetyFlag } =
    input;

  // Staff summary: restate the request, then explain the priority.
  let staffSummary: string;
  if (transcript && transcript.trim()) {
    const cleaned = transcript.trim().replace(/\s+/g, " ");
    staffSummary = `Resident says: "${cleaned}".`;
  } else {
    staffSummary = `Resident requested ${requestType.toLowerCase()}.`;
  }
  staffSummary += reasonForPriority(priority, requestType, detectedKeywords);
  if (safetyFlag) {
    staffSummary +=
      " Safety phrase detected — review promptly; this is not a diagnosis.";
  }

  // Patient confirmation: warm, plain, never clinical.
  const need = NEED_PHRASES[requestType];
  const patientConfirmation = `Staff has been notified that you need ${need}.`;

  return { staffSummary, patientConfirmation };
}
