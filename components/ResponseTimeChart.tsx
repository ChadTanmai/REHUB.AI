"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NameValue } from "@/lib/analyticsUtils";

/** Line/area chart for response time or volume trends over hours. */
export default function ResponseTimeChart({
  data,
  height = 240,
  color = "#2F9E9E",
  unit = "",
}: {
  data: NameValue[];
  height?: number;
  color?: string;
  unit?: string;
}) {
  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-muted text-sm text-slate/50"
      >
        No data yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
        <defs>
          <linearGradient id="rehubFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#D9E2EC" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#334E68", fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fill: "#334E68", fontSize: 11 }} />
        <Tooltip
          formatter={(v) => [`${v}${unit}`, "Value"]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #D9E2EC",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill="url(#rehubFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
