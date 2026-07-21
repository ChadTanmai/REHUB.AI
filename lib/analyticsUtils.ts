/**
 * Analytics aggregation for the Admin dashboard.
 * Pure derivations over the request list — no charts here, just numbers.
 */

import type { Priority, Request, RequestType, Status } from "./types";
import { isActive, minutesBetween } from "./requestUtils";

export interface AdminStats {
  totalToday: number;
  avgResponseMinutes: number | null;
  mostCommonType: RequestType | "—";
  unresolved: number;
  urgentToday: number;
  voiceToday: number;
  avgConfidence: number | null;
}

function isToday(iso: string, now: number = Date.now()): boolean {
  const d = new Date(iso);
  const ref = new Date(now);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function computeStats(requests: Request[], now: number = Date.now()): AdminStats {
  const today = requests.filter((r) => isToday(r.createdAt, now));

  const resolved = requests.filter(
    (r) => r.status === "Resolved" && r.responseTimeMinutes != null,
  );
  const avgResponseMinutes = resolved.length
    ? Math.round(
        (resolved.reduce((s, r) => s + (r.responseTimeMinutes ?? 0), 0) /
          resolved.length) *
          10,
      ) / 10
    : null;

  const typeCounts = countBy(today, (r) => r.requestType);
  const mostCommonType =
    (Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as
      | RequestType
      | undefined) ?? "—";

  const confSamples = requests.filter((r) => r.source !== "Button");
  const avgConfidence = confSamples.length
    ? confSamples.reduce((s, r) => s + r.aiConfidence, 0) / confSamples.length
    : null;

  return {
    totalToday: today.length,
    avgResponseMinutes,
    mostCommonType,
    unresolved: requests.filter(isActive).length,
    urgentToday: today.filter((r) => r.priority === "Urgent").length,
    voiceToday: today.filter((r) => r.source === "Voice").length,
    avgConfidence,
  };
}

function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export interface NameValue {
  name: string;
  value: number;
}

export function requestsByType(requests: Request[]): NameValue[] {
  const counts = countBy(requests, (r) => r.requestType);
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export function requestsByStatus(requests: Request[]): NameValue[] {
  const order: Status[] = ["New", "Acknowledged", "In Progress", "Resolved"];
  const counts = countBy(requests, (r) => r.status);
  return order
    .filter((s) => counts[s])
    .map((s) => ({ name: s, value: counts[s] }));
}

export function requestsByPriority(requests: Request[]): NameValue[] {
  const order: Priority[] = ["Urgent", "Important", "Routine"];
  const counts = countBy(requests, (r) => r.priority);
  return order
    .filter((p) => counts[p])
    .map((p) => ({ name: p, value: counts[p] }));
}

export function voiceVsButton(requests: Request[]): NameValue[] {
  const counts = countBy(requests, (r) =>
    r.source === "Button" ? "Button" : r.source === "Voice" ? "Voice" : "Typed",
  );
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

/** Average response time grouped by the hour a request was created. */
export function avgResponseByHour(requests: Request[]): NameValue[] {
  const buckets: Record<number, { total: number; count: number }> = {};
  for (const r of requests) {
    if (r.status !== "Resolved" || r.responseTimeMinutes == null) continue;
    const hour = new Date(r.createdAt).getHours();
    buckets[hour] = buckets[hour] ?? { total: 0, count: 0 };
    buckets[hour].total += r.responseTimeMinutes;
    buckets[hour].count += 1;
  }
  return Object.entries(buckets)
    .map(([hour, { total, count }]) => ({
      name: `${hour.padStart(2, "0")}:00`,
      value: Number((total / count).toFixed(1)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Request volume grouped by hour (count of requests created). */
export function volumeByHour(requests: Request[]): NameValue[] {
  const counts = countBy(requests, (r) =>
    `${String(new Date(r.createdAt).getHours()).padStart(2, "0")}:00`,
  );
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Request volume per room — surfaces which rooms generate the most demand. */
export function requestsByRoom(requests: Request[]): NameValue[] {
  const counts = countBy(requests, (r) => `Room ${r.roomNumber}`);
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

/** Average response time per priority level — the operational question this
 *  answers: are Urgent requests actually resolved faster than Routine ones? */
export function avgResponseByPriority(requests: Request[]): NameValue[] {
  const order: Priority[] = ["Urgent", "Important", "Routine"];
  const buckets: Record<string, { total: number; count: number }> = {};
  for (const r of requests) {
    if (r.status !== "Resolved" || r.responseTimeMinutes == null) continue;
    buckets[r.priority] = buckets[r.priority] ?? { total: 0, count: 0 };
    buckets[r.priority].total += r.responseTimeMinutes;
    buckets[r.priority].count += 1;
  }
  return order
    .filter((p) => buckets[p])
    .map((p) => ({ name: p, value: Number((buckets[p].total / buckets[p].count).toFixed(1)) }));
}

/** Resolved-request count per staff member — a workload / accountability view. */
export function resolvedByStaff(requests: Request[]): NameValue[] {
  const counts = countBy(
    requests.filter((r) => r.status === "Resolved" && r.acknowledgedBy),
    (r) => r.acknowledgedBy!,
  );
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Flatten resolved requests into CSV rows for export. */
export function toCSV(requests: Request[]): string {
  const headers = [
    "Resident",
    "Room",
    "Request Type",
    "Priority",
    "Source",
    "Status",
    "Created",
    "Acknowledged",
    "Resolved",
    "Response Minutes",
    "AI Confidence",
    "Safety Flag",
  ];

  const rows = requests.map((r) =>
    [
      r.residentName,
      r.roomNumber,
      r.requestType,
      r.priority,
      r.source,
      r.status,
      r.createdAt,
      r.acknowledgedAt ?? "",
      r.resolvedAt ?? "",
      r.responseTimeMinutes != null ? r.responseTimeMinutes.toFixed(1) : "",
      r.aiConfidence.toFixed(2),
      r.safetyFlag ? "yes" : "no",
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

export { minutesBetween };
