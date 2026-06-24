"use client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

import { getAuthClient } from "@/lib/auth/supabase-browser";

export interface FacilityRecord {
  id: string;
  name: string;
  facilityCode: string;
  teamName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  ccn: string | null;
  createdAt: string;
  ownerId: string;
}

export interface MemberRecord {
  id: string;
  facilityId: string;
  userId: string;
  role: string;
  status: string;
  displayName: string | null;
  joinedAt: string;
}

export interface UserFacility {
  facilityId: string;
  facilityName: string;
  facilityCode: string;
  memberRole: string;
  memberStatus: string;
}

function mapFacility(row: Row): FacilityRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    facilityCode: row.facility_code as string,
    teamName: (row.team_name as string) ?? null,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    zip: (row.zip as string) ?? null,
    phone: (row.phone as string) ?? null,
    ccn: (row.ccn as string) ?? null,
    createdAt: row.created_at as string,
    ownerId: row.owner_id as string,
  };
}

export async function createFacility(params: {
  name: string;
  facilityCode: string;
  teamName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  ccn?: string;
}): Promise<FacilityRecord | null> {
  const supabase = getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("facilities")
    .insert({
      name: params.name,
      facility_code: params.facilityCode,
      team_name: params.teamName ?? null,
      address: params.address ?? null,
      city: params.city ?? null,
      state: params.state ?? null,
      zip: params.zip ?? null,
      phone: params.phone ?? null,
      ccn: params.ccn ?? null,
      owner_id: user.id,
    })
    .select()
    .single();

  if (error || !data) return null;
  return mapFacility(data as Row);
}

export async function getUserFacility(): Promise<UserFacility | null> {
  const supabase = getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_user_facility", {
    uid: user.id,
  });

  if (error || !data || (data as Row[]).length === 0) return null;
  const row = (data as Row[])[0];
  return {
    facilityId: row.facility_id as string,
    facilityName: row.facility_name as string,
    facilityCode: row.facility_code as string,
    memberRole: row.member_role as string,
    memberStatus: row.member_status as string,
  };
}

export async function getFacilityByCode(code: string): Promise<FacilityRecord | null> {
  const supabase = getAuthClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("facilities")
    .select()
    .eq("facility_code", code.toUpperCase().trim())
    .single();

  if (error || !data) return null;
  return mapFacility(data as Row);
}

export async function joinFacility(facilityId: string, role: string = "nurse"): Promise<boolean> {
  const supabase = getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("facility_members").upsert({
    facility_id: facilityId,
    user_id: user.id,
    role,
    status: "pending",
  });

  return !error;
}

export async function approveMember(memberId: string): Promise<boolean> {
  const supabase = getAuthClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("facility_members")
    .update({ status: "active" })
    .eq("id", memberId);
  return !error;
}

export async function getPendingMembers(facilityId: string): Promise<MemberRecord[]> {
  const supabase = getAuthClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("facility_members")
    .select()
    .eq("facility_id", facilityId)
    .eq("status", "pending");

  if (error || !data) return [];
  return (data as Row[]).map((row) => ({
    id: row.id as string,
    facilityId: row.facility_id as string,
    userId: row.user_id as string,
    role: row.role as string,
    status: row.status as string,
    displayName: (row.display_name as string) ?? null,
    joinedAt: row.joined_at as string,
  }));
}

export async function saveUserFacilityToMeta(facilityId: string, facilityName: string): Promise<void> {
  const supabase = getAuthClient();
  await supabase.auth.updateUser({
    data: { facility_id: facilityId, facility_name: facilityName },
  });
}

/**
 * Upsert a facility using the SAME id the local store generated (a UUID), via
 * the authenticated client so RLS (owner_id = auth.uid()) is satisfied. This is
 * what makes a facility findable from another device by its code.
 */
export async function upsertFacilityFromStore(params: {
  id: string;
  name: string;
  facilityCode: string;
  teamName?: string;
}): Promise<boolean> {
  const supabase = getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("facilities")
    .upsert(
      {
        id: params.id,
        name: params.name,
        facility_code: params.facilityCode.toUpperCase(),
        team_name: params.teamName ?? "Care Team",
        owner_id: user.id,
      },
      { onConflict: "id" },
    );
  return !error;
}

/** Upsert one room for a facility the user owns. Ids must be UUIDs. */
export async function upsertRoom(params: {
  id: string;
  facilityId: string;
  roomNumber: string;
  displayName: string;
  active?: boolean;
}): Promise<boolean> {
  const supabase = getAuthClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("rooms")
    .upsert(
      {
        id: params.id,
        facility_id: params.facilityId,
        room_number: params.roomNumber,
        display_name: params.displayName,
        active: params.active ?? true,
      },
      { onConflict: "id" },
    );
  return !error;
}

export interface PublicFacility {
  id: string;
  name: string;
  facilityCode: string;
  teamName: string | null;
  rooms: { id: string; roomNumber: string; displayName: string; active: boolean }[];
}

/**
 * Public, cross-device lookup of a facility + its rooms by code.
 * Works without authentication (security-definer RPC). Dash/case-insensitive.
 */
export async function lookupFacilityWithRooms(code: string): Promise<PublicFacility | null> {
  const supabase = getAuthClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("public_facility_with_rooms", {
    code,
  });
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  if (!row?.id) return null;
  return {
    id: row.id,
    name: row.name,
    facilityCode: row.facility_code,
    teamName: row.team_name ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rooms: ((row.rooms ?? []) as any[]).map((r) => ({
      id: r.id,
      roomNumber: r.room_number,
      displayName: r.display_name ?? "",
      active: r.active !== false,
    })),
  };
}
