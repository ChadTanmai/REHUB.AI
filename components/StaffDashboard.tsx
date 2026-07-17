"use client";

import { useState } from "react";
import type { FacilityWorkspace, Status } from "@/lib/types";
import { getStore } from "@/lib/store";
import { isActive } from "@/lib/requestUtils";
import { useNow } from "@/lib/useRehub";
import PriorityAlertStrip from "./PriorityAlertStrip";
import AlertToasts from "./AlertToasts";
import RequestQueue from "./RequestQueue";
import AISummaryPanel from "./AISummaryPanel";
import RoomGrid from "./RoomGrid";

export default function StaffDashboard({
  workspace,
  therapistName = "Care Team",
  facilityId,
}: {
  workspace: FacilityWorkspace;
  therapistName?: string;
  facilityId: string;
}) {
  const store = getStore();
  const now = useNow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"queue" | "rooms">("queue");

  const active = workspace.requests.filter(isActive);
  const urgent = active.filter((r) => r.priority === "Urgent");
  const selected = workspace.requests.find((r) => r.id === selectedId) ?? null;

  function transition(id: string, to: Status) {
    store.transitionRequest(facilityId, id, to, {
      type: "therapist",
      name: therapistName,
    });
  }

  function assign(id: string) {
    store.assignRequest(facilityId, id, therapistName);
  }

  function ack(id: string) {
    transition(id, "Acknowledged");
  }

  return (
    <div className="space-y-5">
      <AlertToasts requests={workspace.requests} />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Assigned rooms" value={workspace.rooms.length} />
        <Stat label="Active requests" value={active.length} />
        <Stat label="Urgent" value={urgent.length} accent={urgent.length > 0} />
        <Stat
          label="Current time"
          value={new Date(now).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        />
      </div>

      {/* Urgent strip */}
      <PriorityAlertStrip
        requests={workspace.requests}
        now={now}
        onAcknowledge={ack}
        onSelect={setSelectedId}
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-white p-1 shadow-soft">
        <TabBtn active={tab === "queue"} onClick={() => setTab("queue")}>
          Active Queue ({active.length})
        </TabBtn>
        <TabBtn active={tab === "rooms"} onClick={() => setTab("rooms")}>
          Room Grid
        </TabBtn>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div>
          {tab === "queue" ? (
            <RequestQueue
              requests={workspace.requests.filter(isActive)}
              now={now}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onTransition={transition}
              onAssign={assign}
            />
          ) : (
            <RoomGrid
              rooms={workspace.rooms}
              requests={workspace.requests}
              onSelectRoom={(id) => {
                setSelectedId(id);
                setTab("queue");
              }}
            />
          )}
        </div>

        {/* AI Summary detail panel */}
        <div className="hidden lg:block">
          <AISummaryPanel request={selected} now={now} onClose={() => setSelectedId(null)} />
        </div>
      </div>

      {/* Resolved today */}
      <details className="rounded-lg border border-gray-muted bg-white p-4 shadow-soft">
        <summary className="cursor-pointer text-sm font-semibold text-navy">
          Resolved today ({workspace.requests.filter((r) => r.status === "Resolved").length})
        </summary>
        <div className="mt-3">
          <RequestQueue
            requests={workspace.requests.filter((r) => r.status === "Resolved")}
            now={now}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onTransition={transition}
            onAssign={assign}
          />
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-muted bg-white p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-panel">
      <p className="text-xs font-medium text-slate/60">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${accent ? "text-coral" : "text-navy"}`} key={String(value)}>
        <span className="rehub-rise inline-block">{value}</span>
      </p>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-teal text-white" : "text-slate hover:bg-offwhite"
      }`}
    >
      {children}
    </button>
  );
}
