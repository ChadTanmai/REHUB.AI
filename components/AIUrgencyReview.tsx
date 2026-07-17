"use client";

import type { AIClassification } from "@/lib/types";
import PriorityBadge from "./PriorityBadge";
import SafetyNote from "./SafetyNote";

/**
 * The confirmation step for voice/typed requests. Shows what Rehub understood —
 * request type and priority — and asks the resident to confirm before anything
 * is sent. It restates a need; it never diagnoses.
 */

export default function AIUrgencyReview({
  classification,
  onConfirm,
  onEdit,
  onCancel,
}: {
  classification: AIClassification;
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-muted bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Request type" value={classification.requestType} />
        <div>
          <p className="text-sm font-medium text-slate/70">Priority</p>
          <div className="mt-1">
            <PriorityBadge priority={classification.priority} />
          </div>
        </div>
      </div>

      {classification.safetyFlag && (
        <SafetyNote variant="emergency" className="mt-4" />
      )}

      {classification.confidence < 0.55 && (
        <div className="mt-4 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-navy">
          I may have misunderstood — please check this is right, or edit it to
          say exactly what you need. You can also use a quick button instead.
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-[56px] rounded-xl bg-teal px-5 text-lg font-semibold text-white shadow-soft transition-colors hover:bg-[#2a8d8d]"
        >
          Confirm Request
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[56px] rounded-xl border-2 border-navy bg-white px-5 text-lg font-semibold text-navy transition-colors hover:bg-navy/5"
        >
          Edit Request
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[56px] rounded-xl border border-gray-muted bg-white px-5 text-lg font-medium text-slate transition-colors hover:bg-offwhite"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate/70">{label}</p>
      <p className="mt-1 text-lg font-semibold text-navy">{value}</p>
    </div>
  );
}
