"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteNav, SiteFooter } from "@/components/SiteNav";
import { getStore } from "@/lib/store";
import { DEMO_FACILITY_CODE } from "@/lib/mockData";
import {
  DEMO_DATA_NOTICE,
  normalizeFacilityCode,
  sanitizeField,
} from "@/lib/security";
import { saveRoomSession } from "@/lib/session";
import { useMounted } from "@/lib/useRehub";

export default function RoomPairingPage() {
  const mounted = useMounted();
  const router = useRouter();
  const [code, setCode] = useState(DEMO_FACILITY_CODE);
  const [roomNumber, setRoomNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  function pair(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const store = getStore();
    const facilityId = store.facilityIdForCode(normalizeFacilityCode(code));
    if (!facilityId) {
      setError("That facility code wasn't found. Check the code and try again.");
      return;
    }
    const num = sanitizeField(roomNumber, 12);
    if (!num) {
      setError("Enter a room number.");
      return;
    }
    const room = store.addRoom(facilityId, {
      roomNumber: num,
      displayName: sanitizeField(displayName, 40) || "Resident",
      deviceId: `device-${num}-${Date.now() % 100000}`,
    });
    const ws = store.getWorkspace(facilityId);
    saveRoomSession({
      deviceType: "room",
      facilityId,
      facilityCode: ws.facility.facilityCode,
      roomId: room.id,
      roomNumber: room.roomNumber,
      displayName: room.displayName,
      pairedAt: new Date().toISOString(),
    });
    router.push(`/room/${room.id}`);
  }

  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
          <h1 className="text-2xl font-bold text-navy">Pair Room Device</h1>
          <p className="mt-2 text-slate">
            Bind this screen to a room in your facility. After pairing it becomes
            the resident&apos;s room screen.
          </p>

          <p className="mt-4 rounded-lg border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm text-[#8a6300]">
            {DEMO_DATA_NOTICE}
          </p>

          <form onSubmit={pair} className="mt-6 space-y-4 rounded-xl border border-gray-muted bg-white p-5">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate">Facility code</span>
              <input
                value={code}
                onChange={(e) => setCode(normalizeFacilityCode(e.target.value))}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate">Room number</span>
              <input
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. 204"
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate">
                Patient display name (optional, demo only)
              </span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="First name only"
                className="input"
              />
            </label>

            {error && <p className="text-sm font-medium text-coral">{error}</p>}

            <button
              type="submit"
              disabled={!mounted}
              className="w-full rounded-lg bg-teal px-5 py-3 font-semibold text-white hover:bg-[#2a8d8d] disabled:opacity-50"
            >
              Pair &amp; open room screen
            </button>
          </form>

          <p className="mt-4 text-sm text-slate/70">
            Need a facility code?{" "}
            <Link href="/setup" className="font-medium text-teal underline">
              Set up a facility
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
