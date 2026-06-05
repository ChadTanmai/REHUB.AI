/**
 * Device session / pairing (MVP mock authentication).
 *
 * A device is paired to a facility and a role using localStorage only — no real
 * passwords. This keeps the demo frictionless while modeling the production
 * shape: a room device is bound to one room; a therapist device subscribes to a
 * facility. Production will replace this with Supabase Auth + a registered
 * device table (see docs/product_spec.md).
 */

"use client";

import type { DeviceType } from "./types";

const ROOM_KEY = "rehub:session:room";
const THERAPIST_KEY = "rehub:session:therapist";

export interface RoomSession {
  deviceType: "room";
  facilityId: string;
  facilityCode: string;
  roomId: string;
  roomNumber: string;
  displayName: string;
  pairedAt: string;
}

export interface TherapistSession {
  deviceType: "therapist";
  facilityId: string;
  facilityCode: string;
  therapistId: string;
  name: string;
  role: string;
  assignedRooms: string[] | "all";
  pairedAt: string;
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function getRoomSession(): RoomSession | null {
  return read<RoomSession>(ROOM_KEY);
}

export function saveRoomSession(session: RoomSession) {
  write(ROOM_KEY, session);
}

export function clearRoomSession() {
  if (typeof window !== "undefined") localStorage.removeItem(ROOM_KEY);
}

export function getTherapistSession(): TherapistSession | null {
  return read<TherapistSession>(THERAPIST_KEY);
}

export function saveTherapistSession(session: TherapistSession) {
  write(THERAPIST_KEY, session);
}

export function clearTherapistSession() {
  if (typeof window !== "undefined") localStorage.removeItem(THERAPIST_KEY);
}

export function deviceLabel(type: DeviceType): string {
  switch (type) {
    case "room":
      return "Patient Room Device";
    case "therapist":
      return "Therapist Dashboard";
    case "admin":
      return "Admin Console";
  }
}
