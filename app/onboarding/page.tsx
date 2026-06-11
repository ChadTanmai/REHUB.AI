"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { EASE } from "@/components/marketing/motion";
import FacilityAutocomplete from "@/components/marketing/FacilityAutocomplete";
import type { TherapistRole } from "@/lib/types";
import { suggestCode, type DirectoryFacility } from "@/lib/facilityDirectory";
import { getStore } from "@/lib/store";
import { saveTherapistSession } from "@/lib/session";
import { saveLead } from "@/lib/leads";
import {
  DEMO_DATA_NOTICE,
  normalizeFacilityCode,
  sanitizeField,
} from "@/lib/security";
import { useMounted } from "@/lib/useRehub";

const ROLES: TherapistRole[] = [
  "Physical Therapist",
  "Occupational Therapist",
  "Nurse",
  "Caregiver",
  "Aide",
];

const STEP_LABELS = ["Facility", "Admin", "Rooms", "Your team", "Launch"];

function codeFromName(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
  return base ? `${base}-01` : "";
}

export default function OnboardingPage() {
  const mounted = useMounted();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  // Facility
  const [facilityName, setFacilityName] = useState("");
  const [code, setCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [matched, setMatched] = useState<DirectoryFacility | null>(null);

  function selectDirectory(f: DirectoryFacility) {
    setFacilityName(f.name);
    setMatched(f);
    if (!codeTouched) setCode(suggestCode(f));
  }

  // Admin
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  // Rooms
  const [rooms, setRooms] = useState<string[]>([]);
  const [roomInput, setRoomInput] = useState("");

  // Team (first therapist = the person setting up)
  const [therName, setTherName] = useState("");
  const [therRole, setTherRole] = useState<TherapistRole>("Physical Therapist");

  const effectiveCode = useMemo(
    () => (codeTouched ? code : codeFromName(facilityName)),
    [code, codeTouched, facilityName],
  );

  function go(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  function addRoom() {
    const v = sanitizeField(roomInput, 12);
    if (!v || rooms.includes(v)) {
      setRoomInput("");
      return;
    }
    setRooms((r) => [...r, v]);
    setRoomInput("");
  }

  function quickFill() {
    // Generate 201–208 if the list is empty.
    if (rooms.length) return;
    setRooms(Array.from({ length: 8 }, (_, i) => String(201 + i)));
  }

  const canContinue = useMemo(() => {
    if (step === 0) return facilityName.trim().length > 1;
    if (step === 3) return therName.trim().length > 1;
    return true;
  }, [step, facilityName, therName]);

  function launch() {
    const store = getStore();
    const facility = store.createFacility({
      name: facilityName || "New Facility",
      facilityCode:
        normalizeFacilityCode(effectiveCode) || `REHUB-${Date.now() % 10000}`,
      roomCount: rooms.length,
      teamName: teamName || `${facilityName} Care Team`,
      address: matched?.address,
      city: matched?.city,
      state: matched?.state,
      zip: matched?.zip,
      phone: matched?.phone,
      ccn: matched?.ccn,
    });

    rooms.forEach((num, i) =>
      store.addRoom(facility.id, {
        roomNumber: num,
        displayName: `Resident ${i + 1}`,
        deviceId: `device-${num}`,
      }),
    );

    const therapist = store.addTherapist(facility.id, {
      name: sanitizeField(therName, 40) || "Care Team",
      role: therRole,
      assignedRooms: "all",
    });

    if (adminEmail.trim()) {
      saveLead({
        kind: "onboarding",
        name: adminName,
        email: adminEmail,
        facility: facilityName,
        message: `Self-serve onboarding · ${rooms.length} rooms`,
      });
    }

    saveTherapistSession({
      deviceType: "therapist",
      facilityId: facility.id,
      facilityCode: facility.facilityCode,
      therapistId: therapist.id,
      name: therapist.name,
      role: therapist.role,
      assignedRooms: "all",
      pairedAt: new Date().toISOString(),
    });

    router.push("/facility");
  }

  return (
    <>
      <MarketingNav />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    {i > 0 && (
                      <div
                        className={`h-0.5 flex-1 transition-colors duration-500 ${
                          i <= step ? "bg-teal" : "bg-gray-muted"
                        }`}
                      />
                    )}
                    <motion.div
                      animate={{
                        backgroundColor: i <= step ? "#2F9E9E" : "#FFFFFF",
                        borderColor: i <= step ? "#2F9E9E" : "#D9E2EC",
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold"
                      style={{ color: i <= step ? "#fff" : "#334E68" }}
                    >
                      {i < step ? "✓" : i + 1}
                    </motion.div>
                    {i < STEP_LABELS.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 transition-colors duration-500 ${
                          i < step ? "bg-teal" : "bg-gray-muted"
                        }`}
                      />
                    )}
                  </div>
                  <span className="mt-1.5 hidden text-xs font-medium text-slate/70 sm:block">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-muted bg-white p-6 shadow-soft sm:p-8">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                initial={{ opacity: 0, x: dir * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -40 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                {step === 0 && (
                  <Step title="Tell us about your facility" subtitle="Search the national directory — we'll auto-fill the rest.">
                    <Field label="Facility name">
                      <FacilityAutocomplete
                        value={facilityName}
                        onChange={(v) => {
                          setFacilityName(v);
                          setMatched(null);
                        }}
                        onSelect={selectDirectory}
                      />
                    </Field>

                    <AnimatePresence>
                      {matched && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-start gap-3 rounded-xl border border-teal/30 bg-mint/50 px-4 py-3">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal text-white">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                            <div className="text-sm">
                              <p className="font-semibold text-navy">Matched from the CMS directory</p>
                              <p className="text-slate/80">
                                {[matched.address, matched.city, matched.state, matched.zip]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                              {matched.phone && (
                                <p className="text-slate/70">{matched.phone} · {matched.ownership}</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Field label="Facility code (residents & staff use this to pair)">
                      <input
                        value={effectiveCode}
                        onChange={(e) => {
                          setCodeTouched(true);
                          setCode(normalizeFacilityCode(e.target.value));
                        }}
                        placeholder="MAPLE-01"
                        className="input font-mono"
                      />
                    </Field>
                    <Field label="Care team name (optional)">
                      <input
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="e.g. Maplewood Care Team"
                        className="input"
                      />
                    </Field>
                  </Step>
                )}

                {step === 1 && (
                  <Step title="Who's the admin?" subtitle="We'll associate this setup with you. Demo only — no account is created.">
                    <Field label="Your name">
                      <input
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="e.g. Jordan Ellis"
                        className="input"
                        autoFocus
                      />
                    </Field>
                    <Field label="Work email (optional)">
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="you@facility.org"
                        className="input"
                      />
                    </Field>
                    <p className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-2.5 text-sm text-[#8a6300]">
                      {DEMO_DATA_NOTICE}
                    </p>
                  </Step>
                )}

                {step === 2 && (
                  <Step title="Add your rooms" subtitle="Add a few now — you can pair the rest anytime.">
                    <div className="flex gap-2">
                      <input
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addRoom();
                          }
                        }}
                        placeholder="Room number, e.g. 204"
                        className="input"
                      />
                      <button
                        type="button"
                        onClick={addRoom}
                        className="shrink-0 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a8d8d]"
                      >
                        Add
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={quickFill}
                      className="text-sm font-medium text-teal hover:underline"
                    >
                      Quick-fill rooms 201–208
                    </button>

                    <div className="flex flex-wrap gap-2">
                      <AnimatePresence>
                        {rooms.map((r) => (
                          <motion.span
                            key={r}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-muted bg-offwhite px-3 py-1.5 text-sm font-medium text-navy"
                          >
                            Room {r}
                            <button
                              type="button"
                              onClick={() => setRooms((list) => list.filter((x) => x !== r))}
                              className="text-slate/50 hover:text-coral"
                            >
                              ×
                            </button>
                          </motion.span>
                        ))}
                      </AnimatePresence>
                      {rooms.length === 0 && (
                        <p className="text-sm text-slate/50">No rooms added yet.</p>
                      )}
                    </div>
                  </Step>
                )}

                {step === 3 && (
                  <Step title="Add yourself to the care team" subtitle="You'll land in the live dashboard as this person.">
                    <Field label="Your name">
                      <input
                        value={therName}
                        onChange={(e) => setTherName(e.target.value)}
                        placeholder="e.g. Dana Whitfield"
                        className="input"
                        autoFocus
                      />
                    </Field>
                    <Field label="Role">
                      <select
                        value={therRole}
                        onChange={(e) => setTherRole(e.target.value as TherapistRole)}
                        className="input"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </Step>
                )}

                {step === 4 && (
                  <Step title="Review & launch" subtitle="Everything's ready. Launch to open your live facility.">
                    <dl className="divide-y divide-gray-muted rounded-xl border border-gray-muted">
                      <Summary label="Facility" value={facilityName || "—"} />
                      <Summary label="Code" value={normalizeFacilityCode(effectiveCode) || "auto"} mono />
                      <Summary label="Rooms" value={rooms.length ? `${rooms.length} (${rooms.join(", ")})` : "None yet"} />
                      <Summary label="You" value={therName ? `${therName} · ${therRole}` : "—"} />
                    </dl>
                    <p className="text-sm text-slate/70">
                      You can pair more rooms and staff anytime from your facility
                      overview.
                    </p>
                  </Step>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Nav buttons */}
            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => (step === 0 ? router.push("/") : go(step - 1))}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate hover:text-navy"
              >
                {step === 0 ? "Cancel" : "Back"}
              </button>

              {step < STEP_LABELS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => canContinue && go(step + 1)}
                  disabled={!canContinue}
                  className="rounded-lg bg-navy px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0c2030] disabled:opacity-40"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={launch}
                  disabled={!mounted || !therName.trim()}
                  className="rounded-lg bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-[#2a8d8d] hover:shadow-panel disabled:opacity-40"
                >
                  Launch facility →
                </button>
              )}
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-slate/60">
            Prefer to talk first?{" "}
            <Link href="/contact" className="font-medium text-teal hover:underline">
              Contact our team
            </Link>
            .
          </p>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">{title}</h1>
      <p className="mt-1.5 text-slate">{subtitle}</p>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate">{label}</span>
      {children}
    </label>
  );
}

function Summary({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-sm text-slate/60">{label}</dt>
      <dd className={`text-sm font-semibold text-navy ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
