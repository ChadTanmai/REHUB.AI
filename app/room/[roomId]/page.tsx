"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import ResidentRequestPanel from "@/components/ResidentRequestPanel";
import SafetyNote from "@/components/SafetyNote";
import EmergencyDisclaimer, { hasAcknowledgedDisclaimer } from "@/components/EmergencyDisclaimer";
import { Logo } from "@/components/SiteNav";
import { getStore } from "@/lib/store";
import { getRoomSession } from "@/lib/session";
import { useMounted, useStoreVersion } from "@/lib/useRehub";

export default function RoomScreen() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const mounted = useMounted();
  useStoreVersion();
  const [acknowledged, setAcknowledged] = useState(false);

  if (!mounted) {
    return <div className="min-h-screen bg-offwhite" />;
  }

  const session = getRoomSession();
  const facilityId = session?.roomId === roomId ? session.facilityId : null;

  const store = getStore();
  const workspace = facilityId ? store.getWorkspace(facilityId) : null;
  const room = workspace?.rooms.find((r) => r.id === roomId);

  if (!room || !workspace || !facilityId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-offwhite px-6 text-center">
        <h1 className="text-2xl font-bold text-navy">Room not paired</h1>
        <p className="max-w-md text-slate">
          This device isn&apos;t paired to a room yet. Ask your facility administrator for the room pairing link.
        </p>
        <Link
          href="/join"
          className="rounded-lg bg-teal px-6 py-3 font-semibold text-white hover:bg-[#2a8d8d]"
        >
          Use pairing code
        </Link>
      </div>
    );
  }

  const showDisclaimer = !acknowledged && !hasAcknowledgedDisclaimer(roomId);

  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      {showDisclaimer && (
        <EmergencyDisclaimer roomId={roomId} onAcknowledge={() => setAcknowledged(true)} />
      )}
      {/* Kiosk header */}
      <header className="border-b border-gray-muted bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-lg font-bold text-navy">Rehub</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-teal">
            <span className="h-2 w-2 rounded-full bg-success" />
            Connected to care team
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-navy sm:text-4xl">
              Room {room.roomNumber}
            </h1>
            {room.displayName && (
              <p className="mt-1 text-xl text-slate">Hello, {room.displayName}</p>
            )}
            <p className="mt-3 text-lg text-slate">What do you need help with?</p>
          </div>

          <div className="mt-8">
            <ResidentRequestPanel facilityId={facilityId} roomId={room.id} />
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-muted bg-white">
        <div className="mx-auto max-w-2xl px-5 py-4">
          <SafetyNote variant="compact" />
          <p className="mt-2 text-center text-xs text-slate/50">
            Connected to Rehub facility network · {workspace?.facility.name}
          </p>
        </div>
      </footer>
    </div>
  );
}
