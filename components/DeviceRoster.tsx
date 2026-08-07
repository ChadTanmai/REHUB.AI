"use client";

import { useEffect, useState } from "react";
import { subscribePresence, sendNudge, type DevicePresence } from "@/lib/supabase/presence";
import { SUPABASE_ENABLED } from "@/lib/supabase";

/**
 * Live roster of every screen currently online for this facility.
 *
 * Shows device/screen status only — never patient content. A device that loses
 * power or network drops off on its own via Supabase Realtime's presence
 * heartbeat, so "online" here means genuinely reachable right now, not "was
 * seen at some point."
 */

function since(ts: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const KIND_META: Record<string, { label: string; cls: string }> = {
  room: { label: "Patient room", cls: "bg-teal/10 text-teal" },
  staff: { label: "Staff", cls: "bg-navy/8 text-navy" },
  admin: { label: "Admin", cls: "bg-amber/15 text-[#9a6a00]" },
};

export default function DeviceRoster({ facilityId }: { facilityId: string }) {
  const [devices, setDevices] = useState<DevicePresence[] | null>(null);
  const [nudged, setNudged] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId || !SUPABASE_ENABLED) return;
    return subscribePresence(facilityId, setDevices);
  }, [facilityId]);

  function nudge(d: DevicePresence, action: "reload" | "go-home") {
    sendNudge(facilityId, d.deviceKey, action);
    setNudged(d.deviceKey);
    setTimeout(() => setNudged(null), 2500);
  }

  if (!SUPABASE_ENABLED) {
    return (
      <div className="rounded-xl border border-dashed border-gray-muted bg-white p-6 text-center text-sm text-slate/60">
        Live device status needs Supabase configured.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-muted bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-gray-muted px-5 py-3.5">
        <div>
          <h3 className="text-sm font-semibold text-navy">Screens online</h3>
          <p className="mt-0.5 text-xs text-slate/60">
            Live — a device that loses power or network drops off automatically.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-md bg-offwhite px-2.5 py-1 text-xs font-medium text-slate">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {devices === null ? "…" : `${devices.length} online`}
        </span>
      </div>

      {devices === null ? (
        <p className="px-5 py-8 text-center text-sm text-slate/50">Connecting…</p>
      ) : devices.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-navy">No screens online yet</p>
          <p className="mt-1 text-xs text-slate/60">
            Open a room tablet or staff dashboard and it will appear here within a second or two.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-muted">
          {devices.map((d) => {
            const meta = KIND_META[d.kind] ?? KIND_META.staff;
            return (
              <div key={d.deviceKey} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-success/60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-navy">{d.label}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate/50">
                    {d.path} · up {since(d.since)}
                  </p>
                </div>
                {nudged === d.deviceKey ? (
                  <span className="text-xs font-semibold text-success">Sent ✓</span>
                ) : (
                  <div className="flex shrink-0 gap-1.5">
                    {d.kind === "room" && (
                      <button
                        onClick={() => nudge(d, "go-home")}
                        title="Send this tablet back to its room screen"
                        className="rounded-md border border-gray-muted bg-white px-2.5 py-1 text-xs font-semibold text-navy hover:bg-offwhite"
                      >
                        Reset screen
                      </button>
                    )}
                    <button
                      onClick={() => nudge(d, "reload")}
                      title="Remotely refresh this device"
                      className="rounded-md border border-gray-muted bg-white px-2.5 py-1 text-xs font-semibold text-navy hover:bg-offwhite"
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
