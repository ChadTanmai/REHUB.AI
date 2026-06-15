"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { getStore } from "@/lib/store";
import { saveRoomSession, saveTherapistSession } from "@/lib/session";
import { nanoid } from "nanoid";

type Step = "choice" | "start-facility" | "join-code";

export default function DemoV2Page() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choice");
  const [facilityName, setFacilityName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [role, setRole] = useState<"patient" | "nurse">("patient");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleStartFacility(e: React.FormEvent) {
    e.preventDefault();
    if (!facilityName.trim()) return;
    setLoading(true);

    const code = nanoid(6).toUpperCase();
    const store = getStore();

    const facilityId = `demo-${code}`;
    store.createFacility({
      name: facilityName.trim(),
      facilityCode: code,
      teamName: "Demo Team",
      roomCount: 1,
    });

    const demoRoom = store.addRoom(facilityId, {
      roomNumber: "Demo",
      displayName: "Demo Room",
    });

    if (role === "nurse") {
      const therapist = store.addTherapist(facilityId, {
        name: "You",
        role: "Nurse",
        assignedRooms: [demoRoom.id],
      });
      saveTherapistSession({
        deviceType: "therapist",
        facilityId,
        facilityCode: code,
        therapistId: therapist.id,
        name: "You",
        role: "Nurse",
        assignedRooms: [demoRoom.id],
        pairedAt: new Date().toISOString(),
      });
      router.push("/therapist");
    } else {
      saveRoomSession({
        deviceType: "room",
        facilityId,
        facilityCode: code,
        roomId: demoRoom.id,
        roomNumber: demoRoom.roomNumber,
        displayName: demoRoom.displayName,
        pairedAt: new Date().toISOString(),
      });
      router.push(`/room/${demoRoom.id}`);
    }
  }

  async function handleJoinFacility(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setLoading(true);
    setError("");

    const code = joinCode.trim().toUpperCase();
    const facilityId = `demo-${code}`;
    const store = getStore();
    const workspace = store.getWorkspace(facilityId);

    if (!workspace || workspace.facility.id.startsWith("demo-") === false) {
      setError("Facility code not found. Please check and try again.");
      setLoading(false);
      return;
    }

    if (role === "nurse") {
      const therapist = store.addTherapist(facilityId, {
        name: "You",
        role: "Nurse",
        assignedRooms: workspace.rooms.map((r) => r.id),
      });
      saveTherapistSession({
        deviceType: "therapist",
        facilityId,
        facilityCode: code,
        therapistId: therapist.id,
        name: "You",
        role: "Nurse",
        assignedRooms: workspace.rooms.map((r) => r.id),
        pairedAt: new Date().toISOString(),
      });
      router.push("/therapist");
    } else {
      const room = workspace.rooms[0];
      if (!room) {
        setError("No rooms available in this facility.");
        setLoading(false);
        return;
      }
      saveRoomSession({
        deviceType: "room",
        facilityId,
        facilityCode: code,
        roomId: room.id,
        roomNumber: room.roomNumber,
        displayName: room.displayName || "Room",
        pairedAt: new Date().toISOString(),
      });
      router.push(`/room/${room.id}`);
    }
  }

  return (
    <>
      <MarketingNav />
      <main className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center bg-offwhite px-4 py-12">
        <div className="w-full max-w-lg">
          {step === "choice" ? (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-navy">Live Demo</h1>
                <p className="mt-2 text-slate/70">
                  Try Rehub with a real facility. Choose how you want to connect.
                </p>
              </div>

              <div className="space-y-3">
                {/* Start Facility */}
                <button
                  onClick={() => setStep("start-facility")}
                  className="w-full rounded-lg border-2 border-navy bg-navy px-6 py-4 text-left text-white transition-all hover:bg-[#0c2030]"
                >
                  <div className="font-semibold">Start Facility</div>
                  <div className="mt-1 text-sm text-white/80">
                    Create a demo facility and invite others to join
                  </div>
                </button>

                {/* Join as Patient */}
                <button
                  onClick={() => {
                    setRole("patient");
                    setStep("join-code");
                  }}
                  className="w-full rounded-lg border-2 border-gray-muted bg-white px-6 py-4 text-left text-navy transition-all hover:border-navy/40"
                >
                  <div className="font-semibold">Join as Patient</div>
                  <div className="mt-1 text-sm text-slate/70">
                    Connect to an existing facility using a code
                  </div>
                </button>

                {/* Join as Nurse */}
                <button
                  onClick={() => {
                    setRole("nurse");
                    setStep("join-code");
                  }}
                  className="w-full rounded-lg border-2 border-gray-muted bg-white px-6 py-4 text-left text-navy transition-all hover:border-navy/40"
                >
                  <div className="font-semibold">Join as Nurse</div>
                  <div className="mt-1 text-sm text-slate/70">
                    Access the staff dashboard with a code
                  </div>
                </button>
              </div>

              <p className="text-center text-xs text-slate/50">
                No real data is stored. This is a demo only.
              </p>
            </div>
          ) : step === "start-facility" ? (
            <form onSubmit={handleStartFacility} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep("choice")}
                className="text-sm font-medium text-teal hover:underline"
              >
                ← Back
              </button>

              <div>
                <h2 className="text-2xl font-bold text-navy">
                  Create Demo Facility
                </h2>
                <p className="mt-1 text-sm text-slate/70">
                  Give your facility a name. You&apos;ll get a code to share.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate">
                  Facility name
                </label>
                <input
                  type="text"
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  placeholder="e.g. Maplewood Rehab"
                  required
                  className="w-full rounded-lg border border-gray-muted bg-white px-4 py-2.5 text-navy placeholder-slate/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate">
                  You join as
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setRole("patient")}
                    className={`w-full rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                      role === "patient"
                        ? "border-navy bg-navy text-white"
                        : "border-gray-muted bg-white text-navy hover:border-navy/40"
                    }`}
                  >
                    Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("nurse")}
                    className={`w-full rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                      role === "nurse"
                        ? "border-navy bg-navy text-white"
                        : "border-gray-muted bg-white text-navy hover:border-navy/40"
                    }`}
                  >
                    Nurse / Staff
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !facilityName.trim()}
                className="w-full rounded-lg bg-teal px-4 py-3 font-semibold text-white transition-colors hover:bg-[#2a8d8d] disabled:opacity-40"
              >
                {loading ? "Creating…" : "Create & Enter"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinFacility} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep("choice")}
                className="text-sm font-medium text-teal hover:underline"
              >
                ← Back
              </button>

              <div>
                <h2 className="text-2xl font-bold text-navy">
                  Join Facility
                </h2>
                <p className="mt-1 text-sm text-slate/70">
                  Enter the code from the facility organizer.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate">
                  Facility code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC123"
                  required
                  className="w-full rounded-lg border border-gray-muted bg-white px-4 py-2.5 text-navy placeholder-slate/50"
                  maxLength={6}
                />
              </div>

              <p className="text-xs text-slate/50">
                Joining as:{" "}
                <span className="font-medium text-slate">
                  {role === "patient" ? "Patient" : "Nurse"}
                </span>
              </p>

              {error && (
                <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !joinCode.trim()}
                className="w-full rounded-lg bg-teal px-4 py-3 font-semibold text-white transition-colors hover:bg-[#2a8d8d] disabled:opacity-40"
              >
                {loading ? "Joining…" : "Join"}
              </button>
            </form>
          )}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
