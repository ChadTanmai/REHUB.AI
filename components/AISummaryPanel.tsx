"use client";

import type { Request } from "@/lib/types";
import {
  formatClock,
  formatWaiting,
  waitingMinutes,
} from "@/lib/requestUtils";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";
import SafetyNote from "./SafetyNote";

/**
 * Detail panel shown when a therapist selects a request.
 * Restates what the resident said and why it was prioritized — never a
 * diagnosis or medical advice.
 */

export default function AISummaryPanel({
  request,
  now,
  onClose,
}: {
  request: Request | null;
  now: number;
  onClose: () => void;
}) {
  if (!request) {
    return (
      <div className="rounded-xl border border-gray-muted bg-white p-6 text-sm text-slate/60">
        Select a request to see its AI summary.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-muted bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-navy">AI Request Summary</h3>
          <p className="text-sm text-slate/70">
            Room {request.roomNumber} · {request.residentName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-slate/60 hover:text-navy"
        >
          Close
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <PriorityBadge priority={request.priority} />
        <StatusBadge status={request.status} />
        <span className="text-xs text-slate/60">
          Score {request.priorityScore} · {Math.round(request.aiConfidence * 100)}%
          confidence
        </span>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        {request.transcript && (
          <Field label="Original transcript">
            <span className="italic text-navy">“{request.transcript}”</span>
          </Field>
        )}
        <Field label="Detected request type">{request.requestType}</Field>
        <Field label="Detected urgency">{request.priority}</Field>
        <Field label="Detected keywords">
          {request.detectedKeywords.length
            ? request.detectedKeywords.join(", ")
            : "—"}
        </Field>
        <Field label="Suggested staff note">{request.notes}</Field>
        <Field label="Source">{request.source}</Field>
        <Field label="Time submitted">{formatClock(request.createdAt)}</Field>
        <Field label="Time waiting">
          {formatWaiting(waitingMinutes(request, now))}
        </Field>
        {request.acknowledgedBy && (
          <Field label="Acknowledged by">{request.acknowledgedBy}</Field>
        )}
      </dl>

      {request.safetyFlag && (
        <SafetyNote variant="emergency" className="mt-4" />
      )}

      <p className="mt-4 rounded-lg bg-offwhite px-3 py-2 text-xs text-slate/60">
        This summary restates the resident&apos;s words and the basis for
        prioritization. It is not a diagnosis or medical advice.
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <dt className="text-slate/60">{label}</dt>
      <dd className="text-navy">{children}</dd>
    </div>
  );
}
