/**
 * Rehub facility workspace store.
 *
 * Architecture:
 *   Patient rooms and therapist dashboards share one facility workspace.
 *   - localStorage  → shared source of truth (survives reloads)
 *   - BroadcastChannel → real-time fan-out across tabs on the same device
 *   - SSE (/api/sync) → real-time fan-out across devices on the same network
 *
 * Identity and facility membership are managed in Supabase Auth + the
 * facilities/facility_members tables (see lib/supabase/facilities.ts).
 * This store handles the live workspace state (rooms, requests, events).
 */

"use client";

import type {
  ActorType,
  EventType,
  Facility,
  FacilityWorkspace,
  Request,
  RequestEvent,
  RequestSource,
  RequestType,
  Room,
  Status,
  Therapist,
} from "./types";
import { classifyRequest } from "./aiClassifier";
import { buildSummary } from "./aiSummary";
import { DEMO_FACILITY_CODE } from "./mockData";
import {
  canTransition,
  minutesBetween,
  recentUnresolvedCount,
} from "./requestUtils";
import { sanitizeField, sanitizeText } from "./security";
import {
  dbCreateFacility,
  dbUpsertRoom,
  dbUpsertTherapist,
  dbInsertRequest,
  dbUpdateRequestStatus,
  dbInsertEvent,
} from "./db";
import { pushSnapshot } from "./networkSync";

const STORAGE_PREFIX = "rehub:facility:";
const DEMO_PREFIX = "rehub:demo:";          // demo facilities use a separate key
const CHANNEL_NAME = "rehub-sync";
const DEMO_TTL_MS = 2 * 60 * 60 * 1000;   // demo data expires after 2 hours

function storageKey(facilityId: string, isDemo?: boolean): string {
  return isDemo ? `${DEMO_PREFIX}${facilityId}` : `${STORAGE_PREFIX}${facilityId}`;
}

/** Purge all demo facilities older than DEMO_TTL_MS from localStorage. */
function purgeExpiredDemoFacilities() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith(DEMO_PREFIX)) continue;
    try {
      const ws = JSON.parse(localStorage.getItem(key)!) as FacilityWorkspace & { _demoCreatedAt?: number };
      const age = now - (ws._demoCreatedAt ?? 0);
      if (age > DEMO_TTL_MS) localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key); // corrupted — remove
    }
  }
}

function uid(prefix: string): string {
  // Use real UUIDs so ids line up 1:1 with the Supabase tables (uuid columns).
  // This is what lets a facility/room created on one device be found on another.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

type Listener = () => void;

class RehubStore {
  private workspaces = new Map<string, FacilityWorkspace>();
  private listeners = new Set<Listener>();
  private version = 0;
  private channel: BroadcastChannel | null = null;
  /** Supabase user id of the currently authenticated account (tenant boundary). */
  private currentOwnerId: string | null = null;

  constructor() {
    // Purge expired demo facilities on every init so old demo data never persists.
    purgeExpiredDemoFacilities();

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (e: MessageEvent) => {
        const facilityId = e.data?.facilityId as string | undefined;
        if (facilityId) this.reloadFromStorage(facilityId);
      };
      // Cross-tab fallback for browsers/contexts without our channel reach.
      window.addEventListener("storage", (e) => {
        if (e.key && (e.key.startsWith(STORAGE_PREFIX) || e.key.startsWith(DEMO_PREFIX))) {
          const facilityId = e.key.startsWith(DEMO_PREFIX)
            ? e.key.slice(DEMO_PREFIX.length)
            : e.key.slice(STORAGE_PREFIX.length);
          this.reloadFromStorage(facilityId);
        }
      });
    }
  }

  // --- subscription (useSyncExternalStore contract) ---

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  // --- tenant isolation (owner scoping) ---

  /**
   * Bind the store to the authenticated account. Every facility the user can
   * see is filtered by this owner id. Switching accounts (or signing out)
   * re-scopes the store and drops any local session that points at a facility
   * the new owner does not own — preventing cross-account data leakage.
   */
  setOwner(ownerId: string | null) {
    if (this.currentOwnerId === ownerId) return;
    this.currentOwnerId = ownerId;
    this.purgeForeignSessions();
    this.emit();
  }

  getOwner(): string | null {
    return this.currentOwnerId;
  }

  /** True when the facility exists and belongs to the current owner. */
  ownsFacility(facilityId: string | null | undefined): boolean {
    if (!facilityId || !this.currentOwnerId) return false;
    const facility = this.loadFacilityMeta(facilityId);
    return facility?.ownerId === this.currentOwnerId;
  }

  /**
   * Claim an orphaned facility (no ownerId) for the current owner.
   * Used to re-associate a user's own Supabase-metadata facility after the
   * ownerId field was introduced. Refuses to claim a facility already owned
   * by a different account.
   */
  claimFacility(facilityId: string, ownerId: string): boolean {
    const ws = this.workspaces.get(facilityId) ?? this.tryLoadWorkspace(facilityId);
    if (!ws) return false;
    if (ws.facility.ownerId && ws.facility.ownerId !== ownerId) return false;
    if (ws.facility.ownerId === ownerId) return true;
    ws.facility.ownerId = ownerId;
    this.workspaces.set(facilityId, ws);
    this.persist(facilityId, false);
    this.emit();
    return true;
  }

  /** Read just a facility's metadata from memory or storage (no side effects). */
  private loadFacilityMeta(facilityId: string): Facility | null {
    const inMem = this.workspaces.get(facilityId);
    if (inMem) return inMem.facility;
    const ws = this.tryLoadWorkspace(facilityId);
    return ws?.facility ?? null;
  }

  private tryLoadWorkspace(facilityId: string): FacilityWorkspace | null {
    if (typeof window === "undefined") return null;
    try {
      const raw =
        localStorage.getItem(storageKey(facilityId)) ??
        localStorage.getItem(storageKey(facilityId, true));
      if (!raw) return null;
      return JSON.parse(raw) as FacilityWorkspace;
    } catch {
      return null;
    }
  }

  /**
   * Clear the therapist (staff) session when it points at a facility the
   * current account does not own. Runs whenever the owner changes, so a stale
   * session from a previously signed-in account can never leak its facility.
   *
   * Room and patient sessions are device-local kiosk pairings (the device is
   * physically bound to one room) and are intentionally left untouched by
   * admin sign-in/out.
   */
  private purgeForeignSessions() {
    if (typeof window === "undefined") return;
    const key = "rehub:session:therapist";
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const session = JSON.parse(raw) as { facilityId?: string };
      if (!this.currentOwnerId || !this.ownsFacility(session.facilityId)) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  private emit() {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  // --- persistence ---

  private persist(facilityId: string, broadcast = true) {
    const ws = this.workspaces.get(facilityId);
    if (!ws || typeof window === "undefined") return;
    const isDemo = (ws as { _isDemo?: boolean })._isDemo === true;
    try {
      const payload = isDemo
        ? { ...ws, _demoCreatedAt: (ws as { _demoCreatedAt?: number })._demoCreatedAt ?? Date.now() }
        : ws;
      localStorage.setItem(storageKey(facilityId, isDemo), JSON.stringify(payload));
    } catch {
      /* storage may be unavailable (private mode) — in-memory still works */
    }
    if (broadcast && this.channel) {
      this.channel.postMessage({ facilityId });
    }
    // Push to the network sync server so other devices on the same WiFi
    // receive the update via SSE (fire-and-forget).
    if (broadcast && !isDemo) pushSnapshot(facilityId, ws);
  }

  reloadFromStorage(facilityId: string) {
    if (typeof window === "undefined") return;
    try {
      // Check both regular and demo prefixes
      const raw = localStorage.getItem(storageKey(facilityId)) ??
                  localStorage.getItem(storageKey(facilityId, true));
      if (raw) {
        this.workspaces.set(facilityId, JSON.parse(raw) as FacilityWorkspace);
        this.emit();
      }
    } catch {
      /* ignore parse errors */
    }
  }

  // --- workspace lifecycle ---

  /** Ensure a facility workspace exists in memory (loads from storage). */
  ensureFacility(facilityId: string): FacilityWorkspace {
    let ws = this.workspaces.get(facilityId);
    if (ws) return ws;

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(storageKey(facilityId)) ??
                    localStorage.getItem(storageKey(facilityId, true));
        if (raw) {
          ws = JSON.parse(raw) as FacilityWorkspace;
          this.workspaces.set(facilityId, ws);
          return ws;
        }
      } catch {
        /* fall through */
      }
    }

    ws = {
      facility: {
        id: facilityId,
        name: "New Facility",
        facilityCode: facilityId.toUpperCase(),
        roomCount: 0,
        teamName: "Care Team",
        createdAt: new Date().toISOString(),
      },
      rooms: [],
      therapists: [],
      requests: [],
      events: [],
    };
    this.workspaces.set(facilityId, ws);
    this.persist(facilityId, false);
    return ws;
  }

  getWorkspace(facilityId: string): FacilityWorkspace {
    return this.ensureFacility(facilityId);
  }

  /**
   * List facilities owned by the current account ONLY.
   *
   * Tenant isolation: a facility is returned only when its ownerId matches the
   * authenticated user. Orphaned facilities (no ownerId) and facilities owned
   * by other accounts are never returned. When no account is bound, returns [].
   */
  listFacilities(): Facility[] {
    if (!this.currentOwnerId) return [];
    const owner = this.currentOwnerId;
    const byId = new Map<string, Facility>();

    const consider = (facility: Facility) => {
      if (facility.ownerId === owner) byId.set(facility.id, facility);
    };

    for (const ws of this.workspaces.values()) {
      if ((ws as { _isDemo?: boolean })._isDemo) continue;
      consider(ws.facility);
    }
    if (typeof window !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(STORAGE_PREFIX)) continue;
        try {
          const ws = JSON.parse(localStorage.getItem(key)!) as FacilityWorkspace;
          if (!byId.has(ws.facility.id)) consider(ws.facility);
        } catch {
          /* ignore */
        }
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
    );
  }

  /** Update facility metadata (name, code, team name, contact). */
  updateFacility(
    facilityId: string,
    patch: Partial<Pick<Facility, "name" | "facilityCode" | "teamName" | "address" | "city" | "state" | "zip" | "phone">>,
  ): Facility | null {
    const ws = this.ensureFacility(facilityId);
    if (patch.name !== undefined) ws.facility.name = sanitizeField(patch.name, 80) || ws.facility.name;
    if (patch.facilityCode !== undefined) ws.facility.facilityCode = patch.facilityCode.trim().toUpperCase();
    if (patch.teamName !== undefined) ws.facility.teamName = sanitizeField(patch.teamName, 80) || ws.facility.teamName;
    if (patch.address !== undefined) ws.facility.address = sanitizeField(patch.address, 120);
    if (patch.city !== undefined) ws.facility.city = sanitizeField(patch.city, 60);
    if (patch.state !== undefined) ws.facility.state = sanitizeField(patch.state, 4);
    if (patch.zip !== undefined) ws.facility.zip = sanitizeField(patch.zip, 10);
    if (patch.phone !== undefined) ws.facility.phone = sanitizeField(patch.phone, 24);
    this.persist(facilityId);
    this.emit();
    return ws.facility;
  }

  /** Permanently delete a facility and all its workspace data. */
  deleteFacility(facilityId: string): boolean {
    this.workspaces.delete(facilityId);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(storageKey(facilityId));
        localStorage.removeItem(storageKey(facilityId, true));
      } catch {
        /* ignore */
      }
    }
    if (this.channel) this.channel.postMessage({ facilityId });
    this.emit();
    return true;
  }

  /**
   * Seed (or refresh) a facility workspace from remote data using the remote
   * ids verbatim. Used by the cross-device join flow so the patient device's
   * local workspace matches the admin's facility and rooms exactly.
   */
  seedRemoteFacility(input: {
    id: string;
    name: string;
    facilityCode: string;
    teamName?: string | null;
    rooms: { id: string; roomNumber: string; displayName: string; active?: boolean }[];
  }): FacilityWorkspace {
    const existing = this.workspaces.get(input.id) ?? this.tryLoadWorkspace(input.id);
    const ws: FacilityWorkspace = existing ?? {
      facility: {
        id: input.id,
        name: input.name,
        facilityCode: input.facilityCode.toUpperCase(),
        roomCount: input.rooms.length,
        teamName: input.teamName ?? "Care Team",
        createdAt: new Date().toISOString(),
      },
      rooms: [],
      therapists: [],
      requests: [],
      events: [],
    };
    ws.facility.name = input.name;
    ws.facility.facilityCode = input.facilityCode.toUpperCase();
    ws.facility.teamName = input.teamName ?? ws.facility.teamName;
    // Merge rooms by id (keep any local-only fields already present).
    for (const r of input.rooms) {
      const found = ws.rooms.find((x) => x.id === r.id);
      if (found) {
        found.roomNumber = r.roomNumber;
        found.displayName = r.displayName || found.displayName;
        found.active = r.active !== false;
      } else {
        ws.rooms.push({
          id: r.id,
          facilityId: input.id,
          roomNumber: r.roomNumber,
          displayName: r.displayName || `Room ${r.roomNumber}`,
          active: r.active !== false,
        });
      }
    }
    ws.facility.roomCount = ws.rooms.length;
    this.workspaces.set(input.id, ws);
    this.persist(input.id, false);
    this.emit();
    return ws;
  }

  /** Resolve a facility id from a (case-insensitive, dash-insensitive) code. */
  facilityIdForCode(code: string): string | null {
    const squash = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const normalized = squash(code);
    if (!normalized) return null;
    // Legacy: support old REHUB-DEMO code for backwards compat only
    if (normalized === squash(DEMO_FACILITY_CODE)) return null;
    // Scan loaded + persisted facilities.
    for (const ws of this.workspaces.values()) {
      if (squash(ws.facility.facilityCode) === normalized) {
        return ws.facility.id;
      }
    }
    if (typeof window !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(STORAGE_PREFIX) && !key?.startsWith(DEMO_PREFIX)) continue;
        try {
          const ws = JSON.parse(localStorage.getItem(key)!) as FacilityWorkspace;
          if (squash(ws.facility.facilityCode) === normalized) {
            this.workspaces.set(ws.facility.id, ws);
            return ws.facility.id;
          }
        } catch {
          /* ignore */
        }
      }
    }
    return null;
  }

  // --- mutations: setup / pairing ---

  /**
   * Create an ephemeral demo facility.
   * Stored under DEMO_PREFIX and automatically expired after 2 hours.
   * Never pushed to Supabase or network sync.
   */
  createDemoFacility(input: { name: string; facilityCode: string }): Facility {
    const facility: Facility = {
      id: uid("demo"),
      name: sanitizeField(input.name, 80) || "Demo Facility",
      facilityCode: input.facilityCode.trim().toUpperCase(),
      roomCount: 0,
      teamName: "Care Team",
      createdAt: new Date().toISOString(),
    };
    const ws = {
      facility,
      rooms: [],
      therapists: [],
      requests: [],
      events: [],
      _isDemo: true,
      _demoCreatedAt: Date.now(),
    } as unknown as FacilityWorkspace;
    this.workspaces.set(facility.id, ws);
    this.persist(facility.id);
    this.emit();
    return facility;
  }

  createFacility(input: {
    name: string;
    facilityCode: string;
    roomCount: number;
    teamName: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    ccn?: string;
  }): Facility {
    const facility: Facility = {
      id: uid("fac"),
      name: sanitizeField(input.name, 80) || "New Facility",
      facilityCode: input.facilityCode.trim().toUpperCase(),
      roomCount: Math.max(0, Math.min(500, Math.floor(input.roomCount) || 0)),
      teamName: sanitizeField(input.teamName, 80) || "Care Team",
      createdAt: new Date().toISOString(),
      // Bind the new facility to the authenticated account that created it.
      ownerId: this.currentOwnerId ?? undefined,
      address: input.address ? sanitizeField(input.address, 120) : undefined,
      city: input.city ? sanitizeField(input.city, 60) : undefined,
      state: input.state ? sanitizeField(input.state, 4) : undefined,
      zip: input.zip ? sanitizeField(input.zip, 10) : undefined,
      phone: input.phone ? sanitizeField(input.phone, 24) : undefined,
      ccn: input.ccn ? sanitizeField(input.ccn, 12) : undefined,
    };
    this.workspaces.set(facility.id, {
      facility,
      rooms: [],
      therapists: [],
      requests: [],
      events: [],
    });
    this.persist(facility.id);
    this.emit();
    // Fire-and-forget: persist to Supabase when configured.
    dbCreateFacility(facility).catch(() => {});
    return facility;
  }

  addRoom(
    facilityId: string,
    input: {
      roomNumber: string;
      displayName: string;
      deviceId?: string;
      name?: string;
      floor?: string;
      wing?: string;
      roomType?: import("./types").RoomType;
      capacity?: number;
      description?: string;
    },
  ): Room {
    const ws = this.ensureFacility(facilityId);
    const existing = ws.rooms.find((r) => r.roomNumber === input.roomNumber);
    if (existing) {
      existing.displayName = input.displayName || existing.displayName;
      existing.active = true;
      existing.deviceId = input.deviceId ?? existing.deviceId;
      existing.lastSeenAt = new Date().toISOString();
      if (input.name !== undefined) existing.name = sanitizeField(input.name, 60);
      if (input.floor !== undefined) existing.floor = sanitizeField(input.floor, 20);
      if (input.wing !== undefined) existing.wing = sanitizeField(input.wing, 20);
      if (input.roomType !== undefined) existing.roomType = input.roomType;
      if (input.capacity !== undefined) existing.capacity = input.capacity;
      if (input.description !== undefined) existing.description = sanitizeField(input.description, 200);
      this.persist(facilityId);
      this.emit();
      return existing;
    }
    const room: Room = {
      id: uid("room"),
      facilityId,
      roomNumber: sanitizeField(input.roomNumber, 12),
      displayName: sanitizeField(input.displayName, 40) || "Room " + input.roomNumber,
      active: true,
      deviceId: input.deviceId,
      lastSeenAt: new Date().toISOString(),
      name: input.name ? sanitizeField(input.name, 60) : `Room ${input.roomNumber}`,
      floor: input.floor ? sanitizeField(input.floor, 20) : undefined,
      wing: input.wing ? sanitizeField(input.wing, 20) : undefined,
      roomType: input.roomType,
      capacity: input.capacity ?? 1,
      patientCount: 0,
      roomStatus: "Available",
      description: input.description ? sanitizeField(input.description, 200) : undefined,
    };
    ws.rooms.push(room);
    ws.facility.roomCount = ws.rooms.length;
    this.persist(facilityId);
    this.emit();
    dbUpsertRoom(room).catch(() => {});
    return room;
  }

  updateRoom(
    facilityId: string,
    roomId: string,
    patch: Partial<Pick<Room, "name" | "floor" | "wing" | "roomType" | "capacity" | "roomStatus" | "description" | "active">>,
  ): Room | null {
    const ws = this.ensureFacility(facilityId);
    const room = ws.rooms.find((r) => r.id === roomId);
    if (!room) return null;
    Object.assign(room, patch);
    this.persist(facilityId);
    this.emit();
    return room;
  }

  deleteRoom(facilityId: string, roomId: string): boolean {
    const ws = this.ensureFacility(facilityId);
    const idx = ws.rooms.findIndex((r) => r.id === roomId);
    if (idx === -1) return false;
    ws.rooms.splice(idx, 1);
    ws.facility.roomCount = ws.rooms.length;
    this.persist(facilityId);
    this.emit();
    return true;
  }

  /** Assign a patient to a room (increments patientCount). */
  assignPatientToRoom(
    facilityId: string,
    roomId: string,
    patientName: string,
  ): Room | null {
    const ws = this.ensureFacility(facilityId);
    const room = ws.rooms.find((r) => r.id === roomId);
    if (!room) return null;
    const count = (room.patientCount ?? 0) + 1;
    const cap = room.capacity ?? 1;
    room.patientCount = count;
    room.displayName = patientName;
    room.roomStatus = count >= cap ? "Occupied" : "Partially Occupied";
    this.persist(facilityId);
    this.emit();
    return room;
  }

  addTherapist(
    facilityId: string,
    input: Omit<Therapist, "id" | "facilityId" | "active">,
  ): Therapist {
    const ws = this.ensureFacility(facilityId);
    const therapist: Therapist = {
      id: uid("ther"),
      facilityId,
      active: true,
      ...input,
    };
    ws.therapists.push(therapist);
    this.persist(facilityId);
    this.emit();
    dbUpsertTherapist(therapist).catch(() => {});
    return therapist;
  }

  // --- mutations: requests ---

  /**
   * Submit a request from a room screen. Runs the deterministic classifier and
   * summary, writes the request + a "created" event, and fans out to all
   * subscribed therapist dashboards.
   */
  submitRequest(input: {
    facilityId: string;
    roomId: string;
    source: RequestSource;
    text?: string;
    fixedType?: RequestType;
    presetUrgency?: import("./types").UrgencyLevel;
  }): Request {
    const ws = this.ensureFacility(input.facilityId);
    const room = ws.rooms.find((r) => r.id === input.roomId);

    const cleanText = input.text ? sanitizeText(input.text) : undefined;
    const recent = recentUnresolvedCount(ws.requests, input.roomId);
    const classification = classifyRequest(cleanText ?? "", {
      fixedType: input.fixedType,
      recentUnresolvedCount: recent,
      presetUrgency: input.presetUrgency,
    });

    const { staffSummary, patientConfirmation } = buildSummary({
      transcript: input.source === "Button" ? undefined : cleanText,
      requestType: classification.requestType,
      priority: classification.priority,
      detectedKeywords: classification.detectedKeywords,
      source: input.source,
      safetyFlag: classification.safetyFlag,
    });

    const now = new Date().toISOString();
    const request: Request = {
      id: uid("req"),
      facilityId: input.facilityId,
      roomId: input.roomId,
      roomNumber: room?.roomNumber ?? "—",
      residentName: room?.displayName ?? "Resident",
      requestType: classification.requestType,
      priority: classification.priority,
      priorityScore: classification.priorityScore,
      urgencyLevel: classification.urgencyLevel,
      triageReason: classification.triageReason,
      suggestedAction: classification.suggestedAction,
      status: "New",
      notes: classification.staffNote,
      aiSummary: staffSummary,
      source: input.source,
      transcript: input.source === "Button" ? undefined : cleanText,
      aiConfidence: classification.confidence,
      detectedKeywords: classification.detectedKeywords,
      safetyFlag: classification.safetyFlag,
      createdAt: now,
    };

    ws.requests.push(request);
    const createdEvent: RequestEvent = {
      id: uid("evt"),
      requestId: request.id,
      facilityId: input.facilityId,
      eventType: "created",
      actorType: "resident",
      actorName: request.residentName,
      newStatus: "New",
      timestamp: new Date().toISOString(),
    };
    ws.events.push(createdEvent);
    this.persist(input.facilityId);
    this.emit();
    dbInsertRequest(request).catch(() => {});
    dbInsertEvent(createdEvent).catch(() => {});
    // patientConfirmation is returned via the request's downstream UI; we expose
    // it on the store for the room screen to read if desired.
    (request as Request & { patientConfirmation?: string }).patientConfirmation =
      patientConfirmation;
    return request;
  }

  /** Move a request to a new status, recording the event and response time. */
  transitionRequest(
    facilityId: string,
    requestId: string,
    to: Status,
    actor: { type: ActorType; name: string },
  ): Request | null {
    const ws = this.ensureFacility(facilityId);
    const req = ws.requests.find((r) => r.id === requestId);
    if (!req) return null;
    if (req.status === to) return req;
    if (!canTransition(req.status, to)) return req;

    const from = req.status;
    const now = new Date().toISOString();
    req.status = to;

    if (to === "Acknowledged") {
      req.acknowledgedAt = now;
      req.acknowledgedBy = actor.name;
      req.assignedTherapist = req.assignedTherapist ?? actor.name;
    } else if (to === "In Progress") {
      req.inProgressAt = now;
      req.assignedTherapist = req.assignedTherapist ?? actor.name;
      if (!req.acknowledgedAt) {
        req.acknowledgedAt = now;
        req.acknowledgedBy = actor.name;
      }
    } else if (to === "Resolved") {
      req.resolvedAt = now;
      req.assignedTherapist = req.assignedTherapist ?? actor.name;
      req.responseTimeMinutes = Number(
        minutesBetween(req.createdAt, now).toFixed(1),
      );
    }

    const eventType: EventType =
      to === "Acknowledged"
        ? "acknowledged"
        : to === "In Progress"
          ? "in_progress"
          : "resolved";

    const transitionEvent = this.pushEvent(ws, {
      requestId,
      facilityId,
      eventType,
      actorType: actor.type,
      actorName: actor.name,
      oldStatus: from,
      newStatus: to,
    });

    this.persist(facilityId);
    this.emit();
    // Supabase persistence (fire-and-forget).
    dbUpdateRequestStatus(requestId, to, actor, {
      acknowledgedAt: req.acknowledgedAt,
      inProgressAt: req.inProgressAt,
      resolvedAt: req.resolvedAt,
      acknowledgedBy: req.acknowledgedBy,
      assignedTherapist: req.assignedTherapist,
      responseTimeMinutes: req.responseTimeMinutes,
    }).catch(() => {});
    dbInsertEvent(transitionEvent).catch(() => {});
    return req;
  }

  /** Claim a request without changing status ("Assign to Me"). */
  assignRequest(
    facilityId: string,
    requestId: string,
    therapistName: string,
  ): Request | null {
    const ws = this.ensureFacility(facilityId);
    const req = ws.requests.find((r) => r.id === requestId);
    if (!req) return null;
    req.assignedTherapist = therapistName;
    this.persist(facilityId);
    this.emit();
    return req;
  }

  private pushEvent(
    ws: FacilityWorkspace,
    e: Omit<RequestEvent, "id" | "timestamp">,
  ): RequestEvent {
    const event: RequestEvent = {
      id: uid("evt"),
      timestamp: new Date().toISOString(),
      ...e,
    };
    ws.events.push(event);
    return event;
  }

  /** Reset a facility's requests and events. */
  resetFacility(facilityId: string) {
    const ws = {
      ...this.ensureFacility(facilityId),
      requests: [],
      events: [],
    };
    this.workspaces.set(facilityId, ws);
    this.persist(facilityId);
    this.emit();
  }
}

// Single shared instance per browser context.
let storeSingleton: RehubStore | null = null;

export function getStore(): RehubStore {
  if (!storeSingleton) storeSingleton = new RehubStore();
  return storeSingleton;
}

export type { RehubStore };
