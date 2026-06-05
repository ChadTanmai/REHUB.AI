"use client";

import type { Request, Status } from "@/lib/types";
import {
  canTransition,
  displayScoreFor,
  formatClock,
  formatWaiting,
  waitingMinutes,
} from "@/lib/requestUtils";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";

const BORDER: Record<string, string> = {
  Urgent: "border-l-coral",
  Important: "border-l-amber",
  Routine: "border-l-teal",
};

export default function RequestRow({
  request,
  now,
  selected,
  onSelect,
  onTransition,
  onAssign,
}: {
  request: Request;
  now: number;
  selected?: boolean;
  onSelect: () => void;
  onTransition: (to: Status) => void;
  onAssign: () => void;
}) {
  const wait = waitingMinutes(request, now);
  const score = displayScoreFor(request, now);
  const resolved = request.status === "Resolved";
  const borderClass = resolved ? "border-l-success" : BORDER[request.priority];

  return (
    <div
      onClick={onSelect}
      className={`rehub-rise cursor-pointer rounded-lg border border-gray-muted border-l-4 bg-white p-4 shadow-soft transition-shadow hover:shadow-panel ${borderClass} ${
        selected ? "ring-2 ring-teal/40" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-navy">
              Room {request.roomNumber}
            </span>
            <span className="text-slate/60">·</span>
            <span className="text-slate">{request.residentName}</span>
            {request.safetyFlag && (
              <span className="rounded bg-coral/12 px-1.5 py-0.5 text-xs font-semibold text-coral">
                Safety flag
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate/80">{request.aiSummary}</p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <PriorityBadge priority={request.priority} />
            <StatusBadge status={request.status} />
          </div>
          <span className="text-xs text-slate/60">
            {request.requestType} · {request.source} · score {score}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-muted pt-3">
        <div className="flex items-center gap-4 text-xs text-slate/70">
          <span>Submitted {formatClock(request.createdAt)}</span>
          <span className={wait >= 5 && !resolved ? "font-semibold text-coral" : ""}>
            Waiting {formatWaiting(wait)}
          </span>
          {request.assignedTherapist && (
            <span>Assigned: {request.assignedTherapist}</span>
          )}
          {request.source !== "Button" && request.aiConfidence < 0.7 && (
            <span className="font-medium text-amber">Low AI confidence</span>
          )}
        </div>

        {!resolved && (
          <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
            <ActionButton
              label="Acknowledge"
              tone="teal"
              disabled={!canTransition(request.status, "Acknowledged")}
              onClick={() => onTransition("Acknowledged")}
            />
            <ActionButton label="Assign to Me" tone="ghost" onClick={onAssign} />
            <ActionButton
              label="In Progress"
              tone="amber"
              disabled={!canTransition(request.status, "In Progress")}
              onClick={() => onTransition("In Progress")}
            />
            <ActionButton
              label="Resolve"
              tone="success"
              disabled={!canTransition(request.status, "Resolved")}
              onClick={() => onTransition("Resolved")}
            />
          </div>
        )}
        {resolved && request.responseTimeMinutes != null && (
          <span className="text-xs font-medium text-success">
            Resolved in {request.responseTimeMinutes} min
          </span>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  tone: "teal" | "amber" | "success" | "ghost";
  onClick: () => void;
  disabled?: boolean;
}) {
  const tones: Record<string, string> = {
    teal: "bg-teal text-white hover:bg-[#2a8d8d]",
    amber: "bg-amber text-navy hover:bg-[#dca515]",
    success: "bg-success text-white hover:bg-[#256c49]",
    ghost: "border border-gray-muted bg-white text-slate hover:bg-offwhite",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {label}
    </button>
  );
}
