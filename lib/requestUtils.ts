/**
 * Request helpers: timing, sorting, status transitions, formatting.
 * Pure functions — no I/O, easy to test and reuse on every surface.
 */

import type { Priority, Request, Status } from "./types";
import { displayScore } from "./priorityAlgorithm";

export function minutesBetween(from: string, to: string | number = Date.now()): number {
  const start = new Date(from).getTime();
  const end = typeof to === "number" ? to : new Date(to).getTime();
  return Math.max(0, (end - start) / 60000);
}

export function waitingMinutes(req: Request, now: number = Date.now()): number {
  // Active requests accrue wait time; resolved ones are frozen at resolution.
  const end =
    req.status === "Resolved" && req.resolvedAt
      ? new Date(req.resolvedAt).getTime()
      : now;
  return minutesBetween(req.createdAt, end);
}

export function formatWaiting(minutes: number): string {
  const m = Math.floor(minutes);
  if (m < 1) return "just now";
  if (m === 1) return "1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

const PRIORITY_RANK: Record<Priority, number> = {
  Urgent: 0,
  Important: 1,
  Routine: 2,
};

const ACTIVE_STATUSES: Status[] = ["New", "Acknowledged", "In Progress"];

export function isActive(req: Request): boolean {
  return ACTIVE_STATUSES.includes(req.status);
}

/**
 * Queue ordering:
 *   1. Urgent → Important → Routine
 *   2. Within a priority, higher display score (which folds in time-waiting
 *      and the repeated-request bonus) first
 *   3. Tie-break on longest waiting
 */
export function sortQueue(requests: Request[], now: number = Date.now()): Request[] {
  return [...requests].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;

    const aScore = displayScore(a.priorityScore, waitingMinutes(a, now));
    const bScore = displayScore(b.priorityScore, waitingMinutes(b, now));
    if (bScore !== aScore) return bScore - aScore;

    return waitingMinutes(b, now) - waitingMinutes(a, now);
  });
}

/** Display score for a request: base score folded with its current wait time. */
export function displayScoreFor(req: Request, now: number = Date.now()): number {
  return displayScore(req.priorityScore, waitingMinutes(req, now));
}

/** Count a resident's unresolved requests created within the last 30 minutes. */
export function recentUnresolvedCount(
  requests: Request[],
  roomId: string,
  now: number = Date.now(),
): number {
  return requests.filter(
    (r) =>
      r.roomId === roomId &&
      isActive(r) &&
      minutesBetween(r.createdAt, now) <= 30,
  ).length;
}

/** Allowed status transitions per the therapist workflow spec. */
const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  New: ["Acknowledged", "In Progress", "Resolved"],
  Acknowledged: ["In Progress", "Resolved"],
  "In Progress": ["Resolved"],
  Resolved: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Patient-facing status message shown on the room screen. */
export function patientStatusMessage(req: Request): string {
  switch (req.status) {
    case "New":
      return "Your request has been sent to the care team.";
    case "Acknowledged":
      return "A staff member has seen your request.";
    case "In Progress":
      return "A staff member is helping now.";
    case "Resolved":
      return "Your request has been marked resolved.";
  }
}
