/**
 * Demo data only. No real patient health information.
 * Names and rooms are fictional and used purely to demonstrate the workflow.
 */

import type {
  Facility,
  FacilityWorkspace,
  Request,
  RequestEvent,
  Resident,
  Room,
  StaffMember,
  Therapist,
} from "./types";

export const DEMO_FACILITY_CODE = "REHUB-DEMO";

export const DEMO_FACILITY: Facility = {
  id: "fac-demo",
  name: "Maplewood Rehabilitation & Senior Living",
  facilityCode: DEMO_FACILITY_CODE,
  roomCount: 8,
  teamName: "Maplewood Care Team",
  createdAt: new Date("2026-01-01T08:00:00").toISOString(),
};

const ROOM_SEED: Array<[string, string]> = [
  ["201", "Eleanor"],
  ["202", "George"],
  ["204", "Margaret"],
  ["205", "James"],
  ["110", "Dorothy"],
  ["118", "Robert"],
  ["102", "Frances"],
  ["120", "Walter"],
];

export const DEMO_ROOMS: Room[] = ROOM_SEED.map(([roomNumber, displayName]) => ({
  id: `room-${roomNumber}`,
  facilityId: DEMO_FACILITY.id,
  roomNumber,
  displayName,
  active: true,
  deviceId: `device-${roomNumber}`,
  lastSeenAt: new Date().toISOString(),
}));

export const DEMO_THERAPISTS: Therapist[] = [
  {
    id: "ther-1",
    facilityId: DEMO_FACILITY.id,
    name: "Dana Whitfield",
    role: "Physical Therapist",
    assignedRooms: "all",
    active: true,
  },
  {
    id: "ther-2",
    facilityId: DEMO_FACILITY.id,
    name: "Marcus Lee",
    role: "Nurse",
    assignedRooms: "all",
    active: true,
  },
  {
    id: "ther-3",
    facilityId: DEMO_FACILITY.id,
    name: "Priya Nair",
    role: "Occupational Therapist",
    assignedRooms: ["room-110", "room-118", "room-102", "room-120"],
    active: true,
  },
];

// Legacy single-facility demo entities for /resident and /staff.
export const DEMO_RESIDENTS: Resident[] = ROOM_SEED.map(([roomNumber, name]) => ({
  id: `res-${roomNumber}`,
  name,
  roomNumber,
  preferredInputMethod: "Button",
}));

export const DEMO_STAFF: StaffMember[] = DEMO_THERAPISTS.map((t) => ({
  id: t.id,
  name: t.name,
  role: t.role,
}));

const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

function roomNumberFor(roomId: string): string {
  return DEMO_ROOMS.find((r) => r.id === roomId)?.roomNumber ?? "—";
}

function residentFor(roomId: string): string {
  return DEMO_ROOMS.find((r) => r.id === roomId)?.displayName ?? "Resident";
}

/**
 * Seed requests. Classification fields are hand-authored to match what the
 * deterministic classifier would produce, so the demo looks realistic without
 * re-running the pipeline.
 */
export const DEMO_REQUESTS: Request[] = [
  {
    id: "req-1",
    facilityId: DEMO_FACILITY.id,
    roomId: "room-204",
    roomNumber: roomNumberFor("room-204"),
    residentName: residentFor("room-204"),
    requestType: "Pain",
    priority: "Urgent",
    priorityScore: 100,
    status: "New",
    notes: "Resident reports pain. Possible safety concern — review promptly.",
    aiSummary:
      'Resident says: "I\'m in pain and I need help getting up." Classified urgent due to pain, get up.',
    source: "Voice",
    transcript: "I'm in pain and I need help getting up.",
    aiConfidence: 0.95,
    detectedKeywords: ["pain", "get up"],
    safetyFlag: false,
    createdAt: minsAgo(3),
  },
  {
    id: "req-2",
    facilityId: DEMO_FACILITY.id,
    roomId: "room-118",
    roomNumber: roomNumberFor("room-118"),
    residentName: residentFor("room-118"),
    requestType: "Bathroom",
    priority: "Important",
    priorityScore: 55,
    status: "Acknowledged",
    notes: "Resident needs help with the bathroom.",
    aiSummary:
      'Resident says: "I need help going to the bathroom." Classified important due to bathroom.',
    source: "Voice",
    transcript: "I need help going to the bathroom.",
    aiConfidence: 0.88,
    detectedKeywords: ["bathroom", "need help"],
    safetyFlag: false,
    createdAt: minsAgo(6),
    acknowledgedAt: minsAgo(4),
    acknowledgedBy: "Marcus Lee",
    assignedTherapist: "Marcus Lee",
  },
  {
    id: "req-3",
    facilityId: DEMO_FACILITY.id,
    roomId: "room-102",
    roomNumber: roomNumberFor("room-102"),
    residentName: residentFor("room-102"),
    requestType: "Water",
    priority: "Routine",
    priorityScore: 20,
    status: "New",
    notes: "Resident requested water.",
    aiSummary: "Resident requested water.",
    source: "Button",
    aiConfidence: 0.9,
    detectedKeywords: ["water"],
    safetyFlag: false,
    createdAt: minsAgo(2),
  },
  {
    id: "req-4",
    facilityId: DEMO_FACILITY.id,
    roomId: "room-205",
    roomNumber: roomNumberFor("room-205"),
    residentName: residentFor("room-205"),
    requestType: "Mobility",
    priority: "Urgent",
    priorityScore: 90,
    status: "In Progress",
    notes:
      "Resident needs mobility assistance. Possible safety concern — review promptly.",
    aiSummary:
      'Resident says: "I feel dizzy and I cannot stand." Classified urgent due to dizzy, cannot stand.',
    source: "Voice",
    transcript: "I feel dizzy and I cannot stand.",
    aiConfidence: 0.9,
    detectedKeywords: ["dizzy", "cannot stand"],
    safetyFlag: false,
    createdAt: minsAgo(9),
    acknowledgedAt: minsAgo(7),
    inProgressAt: minsAgo(5),
    acknowledgedBy: "Dana Whitfield",
    assignedTherapist: "Dana Whitfield",
  },
  {
    id: "req-5",
    facilityId: DEMO_FACILITY.id,
    roomId: "room-201",
    roomNumber: roomNumberFor("room-201"),
    residentName: residentFor("room-201"),
    requestType: "Food",
    priority: "Routine",
    priorityScore: 25,
    status: "Resolved",
    notes: "Resident requested food.",
    aiSummary: "Resident requested food.",
    source: "Button",
    aiConfidence: 0.9,
    detectedKeywords: ["food"],
    safetyFlag: false,
    createdAt: minsAgo(48),
    acknowledgedAt: minsAgo(46),
    inProgressAt: minsAgo(44),
    resolvedAt: minsAgo(40),
    acknowledgedBy: "Priya Nair",
    assignedTherapist: "Priya Nair",
    responseTimeMinutes: 8,
  },
  {
    id: "req-6",
    facilityId: DEMO_FACILITY.id,
    roomId: "room-110",
    roomNumber: roomNumberFor("room-110"),
    residentName: residentFor("room-110"),
    requestType: "Medication Question",
    priority: "Important",
    priorityScore: 50,
    status: "Resolved",
    notes: "Resident has a medication question.",
    aiSummary:
      'Resident says: "I have a question about my medication." Classified important due to medication.',
    source: "Typed",
    transcript: "I have a question about my medication.",
    aiConfidence: 0.85,
    detectedKeywords: ["medication"],
    safetyFlag: false,
    createdAt: minsAgo(95),
    acknowledgedAt: minsAgo(93),
    inProgressAt: minsAgo(90),
    resolvedAt: minsAgo(84),
    acknowledgedBy: "Marcus Lee",
    assignedTherapist: "Marcus Lee",
    responseTimeMinutes: 11,
  },
];

export const DEMO_EVENTS: RequestEvent[] = DEMO_REQUESTS.flatMap((r) => {
  const events: RequestEvent[] = [
    {
      id: `evt-${r.id}-created`,
      requestId: r.id,
      facilityId: r.facilityId,
      eventType: "created",
      timestamp: r.createdAt,
      actorType: "resident",
      actorName: r.residentName,
      newStatus: "New",
    },
  ];
  if (r.acknowledgedAt)
    events.push({
      id: `evt-${r.id}-ack`,
      requestId: r.id,
      facilityId: r.facilityId,
      eventType: "acknowledged",
      timestamp: r.acknowledgedAt,
      actorType: "therapist",
      actorName: r.acknowledgedBy ?? "Care team",
      oldStatus: "New",
      newStatus: "Acknowledged",
    });
  if (r.inProgressAt)
    events.push({
      id: `evt-${r.id}-prog`,
      requestId: r.id,
      facilityId: r.facilityId,
      eventType: "in_progress",
      timestamp: r.inProgressAt,
      actorType: "therapist",
      actorName: r.assignedTherapist ?? "Care team",
      oldStatus: "Acknowledged",
      newStatus: "In Progress",
    });
  if (r.resolvedAt)
    events.push({
      id: `evt-${r.id}-res`,
      requestId: r.id,
      facilityId: r.facilityId,
      eventType: "resolved",
      timestamp: r.resolvedAt,
      actorType: "therapist",
      actorName: r.assignedTherapist ?? "Care team",
      oldStatus: "In Progress",
      newStatus: "Resolved",
    });
  return events;
});

/** Build the full default workspace snapshot used to seed the store. */
export function buildDemoWorkspace(): FacilityWorkspace {
  return {
    facility: { ...DEMO_FACILITY },
    rooms: DEMO_ROOMS.map((r) => ({ ...r })),
    therapists: DEMO_THERAPISTS.map((t) => ({ ...t })),
    requests: DEMO_REQUESTS.map((r) => ({ ...r })),
    events: DEMO_EVENTS.map((e) => ({ ...e })),
  };
}
