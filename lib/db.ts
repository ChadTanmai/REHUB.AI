/**
 * Rehub database repository.
 *
 * Single seam between business logic and persistence.
 * - SUPABASE_ENABLED=true → Supabase Postgres + Realtime
 * - otherwise             → no-ops (local store handles everything)
 *
 * All Supabase calls are fire-and-forget from the store; they never block UI.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ActorType, Facility, Request, RequestEvent, Room, Status, Therapist } from "./types";
import { SUPABASE_ENABLED, getSupabaseClient } from "./supabase";
import { sanitizeField, sanitizeText } from "./security";

type SB = ReturnType<typeof getSupabaseClient>;

function sb(): SB {
  return getSupabaseClient();
}

// ── Facility ──────────────────────────────────────────────────────────────

export async function dbCreateFacility(facility: Facility): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  await (sb().from("facilities") as any).upsert({
    id: facility.id,
    name: facility.name,
    facility_code: facility.facilityCode,
    team_name: facility.teamName,
    room_count: facility.roomCount,
    address: facility.address ?? null,
    city: facility.city ?? null,
    state: facility.state ?? null,
    zip: facility.zip ?? null,
    phone: facility.phone ?? null,
    ccn: facility.ccn ?? null,
    created_at: facility.createdAt,
  });
}

export async function dbGetFacilityByCode(code: string): Promise<Facility | null> {
  if (!SUPABASE_ENABLED) return null;
  const { data } = await (sb().from("facilities") as any)
    .select("*")
    .eq("facility_code", code.toUpperCase())
    .single();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    facilityCode: data.facility_code,
    teamName: data.team_name ?? "",
    roomCount: data.room_count,
    address: data.address ?? undefined,
    city: data.city ?? undefined,
    state: data.state ?? undefined,
    zip: data.zip ?? undefined,
    phone: data.phone ?? undefined,
    ccn: data.ccn ?? undefined,
    createdAt: data.created_at,
  };
}

// ── Rooms ─────────────────────────────────────────────────────────────────

export async function dbUpsertRoom(room: Room): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  await (sb().from("rooms") as any).upsert({
    id: room.id,
    facility_id: room.facilityId,
    room_number: room.roomNumber,
    display_name: room.displayName,
    active: room.active,
    device_id: room.deviceId ?? null,
    last_seen_at: room.lastSeenAt ?? null,
  });
}

export async function dbGetRooms(facilityId: string): Promise<Room[]> {
  if (!SUPABASE_ENABLED) return [];
  const { data } = await (sb().from("rooms") as any)
    .select("*")
    .eq("facility_id", facilityId)
    .order("room_number");
  return ((data as any[]) ?? []).map((r: any) => ({
    id: r.id,
    facilityId: r.facility_id,
    roomNumber: r.room_number,
    displayName: r.display_name ?? "",
    active: r.active,
    deviceId: r.device_id ?? undefined,
    lastSeenAt: r.last_seen_at ?? undefined,
  }));
}

// ── Therapists ────────────────────────────────────────────────────────────

export async function dbUpsertTherapist(t: Therapist): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  await (sb().from("therapists") as any).upsert({
    id: t.id,
    facility_id: t.facilityId,
    name: t.name,
    role: t.role,
    assigned_rooms: t.assignedRooms,
    active: t.active,
  });
}

// ── Requests ──────────────────────────────────────────────────────────────

export async function dbInsertRequest(req: Request): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  await (sb().from("requests") as any).insert({
    id: req.id,
    facility_id: req.facilityId,
    room_id: req.roomId || null,
    room_number: req.roomNumber,
    resident_name: req.residentName,
    request_type: req.requestType,
    priority: req.priority,
    priority_score: req.priorityScore,
    status: req.status,
    notes: req.notes,
    ai_summary: req.aiSummary,
    source: req.source,
    transcript: req.transcript ?? null,
    ai_confidence: req.aiConfidence,
    detected_keywords: req.detectedKeywords,
    safety_flag: req.safetyFlag,
    created_at: req.createdAt,
  });
}

export async function dbUpdateRequestStatus(
  requestId: string,
  to: Status,
  _actor: { type: ActorType; name: string },
  timestamps: {
    acknowledgedAt?: string;
    inProgressAt?: string;
    resolvedAt?: string;
    acknowledgedBy?: string;
    assignedTherapist?: string;
    responseTimeMinutes?: number;
  },
): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  await (sb().from("requests") as any)
    .update({
      status: to,
      acknowledged_at: timestamps.acknowledgedAt ?? null,
      in_progress_at: timestamps.inProgressAt ?? null,
      resolved_at: timestamps.resolvedAt ?? null,
      acknowledged_by: timestamps.acknowledgedBy ?? null,
      assigned_therapist: timestamps.assignedTherapist ?? null,
      response_time_minutes: timestamps.responseTimeMinutes ?? null,
    })
    .eq("id", requestId);
}

export async function dbGetRequests(facilityId: string): Promise<Request[]> {
  if (!SUPABASE_ENABLED) return [];
  const { data } = await (sb().from("requests") as any)
    .select("*")
    .eq("facility_id", facilityId)
    .order("created_at", { ascending: false })
    .limit(500);
  return ((data as any[]) ?? []).map((r: any) => ({
    id: r.id,
    facilityId: r.facility_id,
    roomId: r.room_id ?? "",
    roomNumber: r.room_number ?? "",
    residentName: r.resident_name ?? "",
    requestType: r.request_type,
    priority: r.priority,
    priorityScore: r.priority_score,
    status: r.status,
    notes: r.notes ?? "",
    aiSummary: r.ai_summary ?? "",
    source: r.source,
    transcript: r.transcript ?? undefined,
    aiConfidence: r.ai_confidence ?? 0,
    detectedKeywords: r.detected_keywords ?? [],
    safetyFlag: r.safety_flag,
    assignedTherapist: r.assigned_therapist ?? undefined,
    acknowledgedBy: r.acknowledged_by ?? undefined,
    responseTimeMinutes: r.response_time_minutes ?? undefined,
    createdAt: r.created_at,
    acknowledgedAt: r.acknowledged_at ?? undefined,
    inProgressAt: r.in_progress_at ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
  }));
}

// ── Events ────────────────────────────────────────────────────────────────

export async function dbInsertEvent(event: RequestEvent): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  await (sb().from("request_events") as any).insert({
    id: event.id,
    request_id: event.requestId,
    facility_id: event.facilityId,
    event_type: event.eventType,
    actor_type: event.actorType,
    actor_name: event.actorName,
    old_status: event.oldStatus ?? null,
    new_status: event.newStatus ?? null,
    notes: event.notes ?? null,
    created_at: event.timestamp,
  });
}

// ── Leads ─────────────────────────────────────────────────────────────────

export async function dbInsertLead(lead: {
  kind: string;
  name: string;
  email: string;
  facility?: string;
  rooms?: string;
  message?: string;
}): Promise<void> {
  if (!SUPABASE_ENABLED) return;
  await (sb().from("leads") as any).insert({
    kind: lead.kind,
    name: sanitizeField(lead.name, 80),
    email: sanitizeField(lead.email, 120),
    facility: lead.facility ? sanitizeField(lead.facility, 80) : null,
    rooms: lead.rooms ? sanitizeField(lead.rooms, 20) : null,
    message: lead.message ? sanitizeText(lead.message) : null,
  });
}

// ── Directory search via Supabase full-text ───────────────────────────────

export async function dbSearchDirectory(
  query: string,
  limit = 8,
): Promise<Array<{
  ccn: string; name: string; city: string; state: string;
  zip: string; phone: string; ownership: string; address: string;
}>> {
  if (!SUPABASE_ENABLED) return [];
  const { data } = await (sb().from("facility_directory") as any)
    .select("ccn, name, city, state, zip, phone, ownership, address")
    .textSearch("name", query, { type: "websearch", config: "simple" })
    .limit(limit);
  return (data as any[]) ?? [];
}
