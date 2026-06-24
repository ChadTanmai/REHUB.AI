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

/** Five-level triage urgency surfaced by the AI triage engine. */
export type UrgencyLevel = "Critical" | "High" | "Medium" | "Low" | "Informational";

export const URGENCY_LEVELS: UrgencyLevel[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational",
];

/** Display metadata for each urgency level (color + label + sort weight). */
export const URGENCY_META: Record<
  UrgencyLevel,
  { label: string; color: string; bg: string; dot: string; rank: number }
> = {
  Critical:      { label: "Critical",      color: "#dc2626", bg: "#fef2f2", dot: "#dc2626", rank: 5 },
  High:          { label: "High",          color: "#ea580c", bg: "#fff7ed", dot: "#ea580c", rank: 4 },
  Medium:        { label: "Medium",        color: "#ca8a04", bg: "#fefce8", dot: "#ca8a04", rank: 3 },
  Low:           { label: "Low",           color: "#2563eb", bg: "#eff6ff", dot: "#2563eb", rank: 2 },
  Informational: { label: "Info",          color: "#64748b", bg: "#f8fafc", dot: "#94a3b8", rank: 1 },
};

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
  /** Five-level triage urgency (Critical…Informational). */
  urgencyLevel: UrgencyLevel;
  /** Short, plain-English reason for the urgency call (for staff). */
  triageReason: string;
  /** Recommended next action for staff. */
  suggestedAction: string;
}

export interface Facility {
  id: string;
  name: string;
  facilityCode: string;
  roomCount: number;
  teamName: string;
  createdAt: string;
  /**
   * Supabase user id of the account that owns this facility.
   * Tenant-isolation boundary: only the owner sees the facility in their
   * facility list. Facilities with no ownerId are orphaned (legacy) and are
   * invisible to every account until explicitly claimed.
   */
  ownerId?: string;
  /** Optional real location, auto-filled from the CMS directory. */
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  /** CMS Certification Number when matched to a directory facility. */
  ccn?: string;
}

export type RoomStatus =
  | "Available"
  | "Occupied"
  | "Partially Occupied"
  | "Maintenance"
  | "Cleaning"
  | "Offline"
  | "Restricted";

export type RoomType =
  | "Standard"
  | "Private"
  | "ICU"
  | "Recovery"
  | "Therapy"
  | "Observation";

export interface Room {
  id: string;
  facilityId: string;
  roomNumber: string;
  displayName: string; // current patient's name (or room label when empty)
  active: boolean;
  deviceId?: string;
  lastSeenAt?: string;
  // Admin-managed metadata
  name?: string;          // e.g. "Room 101", "Suite A"
  floor?: string;
  wing?: string;
  roomType?: RoomType;
  capacity?: number;      // max patients (default 1)
  patientCount?: number;  // current patients
  roomStatus?: RoomStatus;
  description?: string;
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
  urgencyLevel?: UrgencyLevel;
  triageReason?: string;
  suggestedAction?: string;
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
