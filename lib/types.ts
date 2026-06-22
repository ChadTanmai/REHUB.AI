/**
 * Rehub core data model.
 *
 * These types describe the shared facility workspace: a single facility owns
 * many rooms, many therapists, and a live stream of requests. The same shapes
 * are used by the mock/local store today and map 1:1 onto the planned Supabase
 * tables (see docs/product_spec.md and lib/supabase.ts).
 */

export type RequestType =
  | "Help"
  | "Pain"
  | "Bathroom"
  | "Water"
  | "Food"
  | "Mobility"
  | "Medication Question"
  | "Custom";

export const REQUEST_TYPES: RequestType[] = [
  "Help",
  "Pain",
  "Bathroom",
  "Water",
  "Food",
  "Mobility",
  "Medication Question",
  "Custom",
];

export type Priority = "Routine" | "Important" | "Urgent";

export const PRIORITIES: Priority[] = ["Routine", "Important", "Urgent"];

export type Status = "New" | "Acknowledged" | "In Progress" | "Resolved";

export const STATUSES: Status[] = [
  "New",
  "Acknowledged",
  "In Progress",
  "Resolved",
];

export type RequestSource = "Button" | "Voice" | "Typed";

/** The pure output of the deterministic classifier. */
export interface AIClassification {
  requestType: RequestType;
  priority: Priority;
  priorityScore: number;
  confidence: number;
  staffNote: string;
  detectedKeywords: string[];
  safetyFlag: boolean;
}

export interface Facility {
  id: string;
  name: string;
  facilityCode: string;
  roomCount: number;
  teamName: string;
  createdAt: string;
  /** Optional real location, auto-filled from the CMS directory. */
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  /** CMS Certification Number when matched to a directory facility. */
  ccn?: string;
}

export interface Room {
  id: string;
  facilityId: string;
  roomNumber: string;
  displayName: string; // resident display name, never store full legal name here
  active: boolean;
  deviceId?: string;
  lastSeenAt?: string;
}

export type TherapistRole =
  | "Physical Therapist"
  | "Occupational Therapist"
  | "Nurse"
  | "Caregiver"
  | "Aide";

export interface Therapist {
  id: string;
  facilityId: string;
  name: string;
  role: TherapistRole;
  /** Room ids this therapist covers, or "all". */
  assignedRooms: string[] | "all";
  active: boolean;
}

export interface Request {
  id: string;
  facilityId: string;
  roomId: string;
  roomNumber: string;
  residentName: string; // demo name only
  requestType: RequestType;
  priority: Priority;
  priorityScore: number;
  status: Status;
  notes: string; // staff-facing note from the classifier
  aiSummary: string; // short staff-facing summary
  source: RequestSource;
  transcript?: string; // present for Voice / Typed
  aiConfidence: number;
  detectedKeywords: string[];
  safetyFlag: boolean;
  createdAt: string;
  acknowledgedAt?: string;
  inProgressAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  assignedTherapist?: string;
  responseTimeMinutes?: number;
}

export type EventType =
  | "created"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "reopened";

export type ActorType = "resident" | "therapist" | "system";

export interface RequestEvent {
  id: string;
  requestId: string;
  facilityId: string;
  eventType: EventType;
  timestamp: string;
  actorType: ActorType;
  actorName: string;
  oldStatus?: Status;
  newStatus?: Status;
  notes?: string;
}

export type DeviceType = "room" | "therapist" | "admin";

export interface DeviceSession {
  id: string;
  facilityId: string;
  deviceType: DeviceType;
  roomId?: string;
  therapistId?: string;
  deviceName: string;
  lastSeenAt: string;
}

/** Legacy single-facility entities kept for the /resident and /staff demo pages. */
export interface Resident {
  id: string;
  name: string;
  roomNumber: string;
  accessibilityNotes?: string;
  preferredInputMethod?: RequestSource;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

/** Full serializable snapshot of one facility workspace — the unit the store persists. */
export interface FacilityWorkspace {
  facility: Facility;
  rooms: Room[];
  therapists: Therapist[];
  requests: Request[];
  events: RequestEvent[];
}
