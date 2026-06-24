"use client";

/**
 * Cross-device request/message delivery.
 *
 * Patient (unauthenticated) → submit_patient_request RPC → requests table.
 * Nurse (authenticated owner) → reads via RLS + subscribes to Supabase Realtime
 * so a message from a patient on any device/network appears instantly on the
 * command center.
 */

import { getAuthClient } from "@/lib/auth/supabase-browser";
import type { Status, UrgencyLevel } from "@/lib/types";

export interface RemoteRequest {
  id: string;
  facilityId: string;
  roomId: string | null;
  roomNumber: string | null;
  residentName: string | null;
  text: string | null;
  source: string | null;
  requestType: string | null;
  priority: string | null;
  urgencyLevel: UrgencyLevel | null;
  triageReason: string | null;
  suggestedAction: string | null;
  status: string;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): RemoteRequest {
  return {
    id: r.id,
    facilityId: r.facility_id,
    roomId: r.room_id ?? null,
    roomNumber: r.room_number ?? null,
    residentName: r.resident_name ?? null,
    text: r.text ?? null,
    source: r.source ?? null,
    requestType: r.request_type ?? null,
    priority: r.priority ?? null,
    urgencyLevel: (r.urgency_level ?? null) as UrgencyLevel | null,
    triageReason: r.triage_reason ?? null,
    suggestedAction: r.suggested_action ?? null,
    status: r.status ?? "New",
    createdAt: r.created_at,
    acknowledgedAt: r.acknowledged_at ?? null,
    resolvedAt: r.resolved_at ?? null,
  };
}

/** Patient-side submit (works without an account). Returns the new id or null. */
export async function submitPatientRequest(p: {
  facilityCode: string;
  roomId: string;
  roomNumber: string;
  residentName: string;
  text: string;
  source: string;
  requestType: string;
  priority: string;
  urgencyLevel: string;
  triageReason: string;
  suggestedAction: string;
}): Promise<string | null> {
  try {
    const supabase = getAuthClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("submit_patient_request", {
      p_facility_code: p.facilityCode,
      p_room_id: p.roomId,
      p_room_number: p.roomNumber,
      p_resident_name: p.residentName,
      p_text: p.text,
      p_source: p.source,
      p_request_type: p.requestType,
      p_priority: p.priority,
      p_urgency_level: p.urgencyLevel,
      p_triage_reason: p.triageReason,
      p_suggested_action: p.suggestedAction,
    });
    if (error) return null;
    return (data as string) ?? null;
  } catch {
    return null;
  }
}

/** Nurse-side: load recent requests for a facility. */
export async function fetchFacilityRequests(facilityId: string): Promise<RemoteRequest[]> {
  try {
    const supabase = getAuthClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("requests")
      .select("*")
      .eq("facility_id", facilityId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error || !data) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map(mapRow);
  } catch {
    return [];
  }
}

/** Nurse-side: subscribe to live inserts/updates. Returns an unsubscribe fn. */
export function subscribeFacilityRequests(
  facilityId: string,
  onChange: (r: RemoteRequest) => void,
): () => void {
  try {
    const supabase = getAuthClient();
    const channel = supabase
      .channel(`requests:${facilityId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "requests", filter: `facility_id=eq.${facilityId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (payload.new) onChange(mapRow(payload.new));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  } catch {
    return () => {};
  }
}

/** Nurse-side: update a request's status (acknowledge / in progress / resolve). */
export async function updateRequestStatus(id: string, status: Status): Promise<boolean> {
  try {
    const supabase = getAuthClient();
    const patch: Record<string, unknown> = { status };
    if (status === "Acknowledged") patch.acknowledged_at = new Date().toISOString();
    if (status === "Resolved") patch.resolved_at = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("requests").update(patch).eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
