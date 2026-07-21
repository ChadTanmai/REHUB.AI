"use client";

import { motion } from "framer-motion";
import type { Request } from "@/lib/types";
import {
  avgResponseByHour,
  avgResponseByPriority,
  computeStats,
  requestsByPriority,
  requestsByRoom,
  requestsByStatus,
  requestsByType,
  resolvedByStaff,
  voiceVsButton,
  volumeByHour,
} from "@/lib/analyticsUtils";
import { formatClock } from "@/lib/requestUtils";
import RequestCategoryChart from "./RequestCategoryChart";
import ResponseTimeChart from "./ResponseTimeChart";
import ExportCSVButton from "./ExportCSVButton";
import PriorityBadge from "./PriorityBadge";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function AdminAnalytics({ requests }: { requests: Request[] }) {
  const stats = computeStats(requests);
  const resolved = requests
    .filter((r) => r.status === "Resolved")
    .sort(
      (a, b) =>
        new Date(b.resolvedAt ?? b.createdAt).getTime() -
        new Date(a.resolvedAt ?? a.createdAt).getTime(),
    );

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Card label="Total Requests Today" value={stats.totalToday} />
        <Card
          label="Avg Response Time"
          value={
            stats.avgResponseMinutes != null
              ? `${stats.avgResponseMinutes.toFixed(1)} min`
              : "—"
          }
        />
        <Card label="Most Common Request" value={stats.mostCommonType} />
        <Card label="Unresolved Requests" value={stats.unresolved} accent={stats.unresolved > 0} />
        <Card label="Urgent Requests Today" value={stats.urgentToday} accent={stats.urgentToday > 0} />
        <Card label="Voice Requests Today" value={stats.voiceToday} />
        <Card
          label="Avg AI Confidence"
          value={
            stats.avgConfidence != null
              ? `${Math.round(stats.avgConfidence * 100)}%`
              : "—"
          }
        />
        <div className="flex items-end justify-center rounded-lg border border-gray-muted bg-white p-3 shadow-soft">
          <ExportCSVButton requests={requests} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Request Categories" index={0}>
          <RequestCategoryChart data={requestsByType(requests)} />
        </ChartCard>
        <ChartCard title="Average Response Time by Hour" index={1}>
          <ResponseTimeChart data={avgResponseByHour(requests)} unit=" min" />
        </ChartCard>
        <ChartCard title="Request Volume Over Time" index={2}>
          <ResponseTimeChart data={volumeByHour(requests)} color="#102A43" />
        </ChartCard>
        <ChartCard title="Status Breakdown" index={3}>
          <RequestCategoryChart data={requestsByStatus(requests)} />
        </ChartCard>
        <ChartCard title="Priority Breakdown" index={4}>
          <RequestCategoryChart data={requestsByPriority(requests)} />
        </ChartCard>
        <ChartCard title="Voice vs Button Requests" index={5}>
          <RequestCategoryChart data={voiceVsButton(requests)} />
        </ChartCard>
        <ChartCard title="Busiest Rooms" index={6}>
          <RequestCategoryChart data={requestsByRoom(requests)} />
        </ChartCard>
        <ChartCard title="Response Time by Priority" index={7}>
          <RequestCategoryChart data={avgResponseByPriority(requests)} />
        </ChartCard>
        <ChartCard title="Resolved per Staff Member" index={8}>
          <RequestCategoryChart data={resolvedByStaff(requests)} />
        </ChartCard>
      </div>

      {/* Recent resolved table */}
      <div className="overflow-hidden rounded-lg border border-gray-muted bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-gray-muted px-4 py-3">
          <h3 className="text-sm font-semibold text-navy">Recent Resolved Requests</h3>
          <ExportCSVButton requests={resolved} filename="rehub-resolved.csv" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-offwhite text-xs uppercase tracking-wide text-slate/60">
              <tr>
                {["Resident", "Type", "Priority", "Source", "Submitted", "Acknowledged", "Resolved", "Response"].map(
                  (h) => (
                    <th key={h} className="px-4 py-2 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {resolved.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate/50">
                    No resolved requests yet.
                  </td>
                </tr>
              )}
              {resolved.map((r) => (
                <tr key={r.id} className="border-t border-gray-muted">
                  <td className="px-4 py-2 text-navy">
                    {r.residentName} · {r.roomNumber}
                  </td>
                  <td className="px-4 py-2">{r.requestType}</td>
                  <td className="px-4 py-2">
                    <PriorityBadge priority={r.priority} />
                  </td>
                  <td className="px-4 py-2">{r.source}</td>
                  <td className="px-4 py-2 text-slate/70">{formatClock(r.createdAt)}</td>
                  <td className="px-4 py-2 text-slate/70">
                    {r.acknowledgedAt ? formatClock(r.acknowledgedAt) : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate/70">
                    {r.resolvedAt ? formatClock(r.resolvedAt) : "—"}
                  </td>
                  <td className="px-4 py-2 font-medium text-success">
                    {r.responseTimeMinutes != null ? `${r.responseTimeMinutes} min` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-muted bg-white p-3 shadow-soft">
      <p className="text-xs font-medium text-slate/60">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ? "text-coral" : "text-navy"}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children, index = 0 }: { title: string; children: React.ReactNode; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.05 * index }}
      className="rounded-lg border border-gray-muted bg-white p-4 shadow-soft"
    >
      <h3 className="mb-3 text-sm font-semibold text-navy">{title}</h3>
      {children}
    </motion.div>
  );
}
