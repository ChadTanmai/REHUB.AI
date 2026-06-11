"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NameValue } from "@/lib/analyticsUtils";

const COLORS = ["#2F9E9E", "#102A43", "#F0B429", "#D95D4F", "#2F855A", "#334E68"];

/** Horizontal-ish category bar chart for request types / priorities / status. */
export default function RequestCategoryChart({
  data,
  height = 240,
}: {
  data: NameValue[];
  height?: number;
}) {
  if (data.length === 0) return <Empty height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: "#334E68", fontSize: 11 }}
          interval={0}
          angle={data.length > 4 ? -20 : 0}
          textAnchor={data.length > 4 ? "end" : "middle"}
          height={data.length > 4 ? 56 : 30}
        />
        <YAxis allowDecimals={false} tick={{ fill: "#334E68", fontSize: 11 }} />
        <Tooltip
          cursor={{ fill: "rgba(47,158,158,0.08)" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #D9E2EC",
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ height }: { height: number }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center rounded-lg border border-dashed border-gray-muted text-sm text-slate/50"
    >
      No data yet
    </div>
  );
}
