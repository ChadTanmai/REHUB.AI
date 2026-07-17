"use client";

import type { Request, Room } from "@/lib/types";
import { formatClock, isActive } from "@/lib/requestUtils";

/**
 * Visual grid of all rooms with their current state. Gives therapists an
 * at-a-glance map of the floor.
 */

interface RoomState {
  room: Room;
  label: string;
  strip: string;
  bg: string;
  lastRequest?: Request;
}

function deriveState(room: Room, requests: Request[]): RoomState {
  const roomReqs = requests
    .filter((r) => r.roomId === room.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const active = roomReqs.find(isActive);
  const last = roomReqs[0];

  if (!active) {
    return {
      room,
      label: "No active request",
      strip: "bg-gray-muted",
      bg: "bg-white",
      lastRequest: last,
    };
  }

  const byStatus: Record<string, { label: string; strip: string; bg: string }> = {
    New: { label: "Waiting", strip: "bg-coral", bg: "bg-coral/5" },
    Acknowledged: { label: "Acknowledged", strip: "bg-teal", bg: "bg-teal/5" },
    "In Progress": { label: "In Progress", strip: "bg-amber", bg: "bg-amber/5" },
    Resolved: { label: "Resolved", strip: "bg-success", bg: "bg-success/5" },
  };

  // Urgent waiting rooms get the coral strip regardless of status nuance.
  const base = byStatus[active.status];
  const strip =
    active.priority === "Urgent" && active.status === "New" ? "bg-coral" : base.strip;

  return { room, label: base.label, strip, bg: base.bg, lastRequest: active };
}

export default function RoomGrid({
  rooms,
  requests,
  onSelectRoom,
}: {
  rooms: Room[];
  requests: Request[];
  onSelectRoom?: (roomId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {rooms.map((room) => {
        const s = deriveState(room, requests);
        const initials = room.displayName
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        return (
          <button
            type="button"
            key={room.id}
            onClick={() =>
              s.lastRequest && onSelectRoom?.(s.lastRequest.id)
            }
            className={`overflow-hidden rounded-lg border border-gray-muted text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-panel ${s.bg}`}
          >
            <div className={`h-1.5 w-full ${s.strip}`} />
            <div className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-navy">
                  Room {room.roomNumber}
                </span>
                <span className="rounded bg-navy/8 px-1.5 py-0.5 text-xs font-medium text-navy">
                  {initials}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate/80">{s.label}</p>
              {s.lastRequest && (
                <p className="mt-0.5 text-xs text-slate/55">
                  Last: {formatClock(s.lastRequest.createdAt)}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
