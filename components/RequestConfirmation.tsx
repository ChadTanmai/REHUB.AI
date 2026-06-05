"use client";

import type { Request } from "@/lib/types";
import { formatClock, patientStatusMessage } from "@/lib/requestUtils";
import StatusBadge from "./StatusBadge";
import SafetyNote from "./SafetyNote";

/**
 * Post-send confirmation shown to the resident. Reassuring, plain-language, and
 * always shows the current status of their active request — never staff
 * analytics.
 */

export default function RequestConfirmation({
  request,
  onNewRequest,
}: {
  request: Request;
  onNewRequest: () => void;
}) {
  return (
    <div className="rounded-xl border border-success/30 bg-success/8 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success text-white">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <p className="text-xl font-semibold text-navy">
        {patientStatusMessage(request)}
      </p>
      <p className="mt-1 text-base text-slate/80">Staff has been notified.</p>

      <div className="mx-auto mt-5 max-w-sm space-y-2 rounded-lg border border-gray-muted bg-white p-4 text-left text-base">
        <Row label="Request" value={request.requestType} />
        <Row label="Time submitted" value={formatClock(request.createdAt)} />
        <div className="flex items-center justify-between">
          <span className="text-slate/70">Status</span>
          <StatusBadge status={request.status} />
        </div>
      </div>

      {request.safetyFlag && <SafetyNote variant="emergency" className="mt-4 text-left" />}

      <button
        type="button"
        onClick={onNewRequest}
        className="mt-6 min-h-[56px] w-full rounded-xl border-2 border-navy bg-white px-5 text-lg font-semibold text-navy transition-colors hover:bg-navy/5"
      >
        Make another request
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate/70">{label}</span>
      <span className="font-semibold text-navy">{value}</span>
    </div>
  );
}
