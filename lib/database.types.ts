/**
 * Auto-generated-style Supabase database types.
 *
 * Keep in sync with supabase/migrations/0001_init.sql.
 * In production, run `supabase gen types typescript` to regenerate from
 * the live schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      facility_directory: {
        Row: {
          ccn: string;
          name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          county: string | null;
          phone: string | null;
          ownership: string | null;
        };
        Insert: {
          ccn: string;
          name: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          county?: string | null;
          phone?: string | null;
          ownership?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["facility_directory"]["Insert"]>;
      };
      facilities: {
        Row: {
          id: string;
          name: string;
          facility_code: string;
          team_name: string | null;
          room_count: number;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          phone: string | null;
          ccn: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          facility_code: string;
          team_name?: string | null;
          room_count?: number;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          phone?: string | null;
          ccn?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["facilities"]["Insert"]>;
      };
      rooms: {
        Row: {
          id: string;
          facility_id: string;
          room_number: string;
          display_name: string | null;
          active: boolean;
          device_id: string | null;
          last_seen_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          facility_id: string;
          room_number: string;
          display_name?: string | null;
          active?: boolean;
          device_id?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]>;
      };
      therapists: {
        Row: {
          id: string;
          facility_id: string;
          name: string;
          role: string | null;
          assigned_rooms: Json;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          facility_id: string;
          name: string;
          role?: string | null;
          assigned_rooms?: Json;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["therapists"]["Insert"]>;
      };
      requests: {
        Row: {
          id: string;
          facility_id: string;
          room_id: string | null;
          room_number: string | null;
          resident_name: string | null;
          request_type: string;
          priority: string;
          priority_score: number;
          status: string;
          notes: string | null;
          ai_summary: string | null;
          source: string;
          transcript: string | null;
          ai_confidence: number | null;
          detected_keywords: string[] | null;
          safety_flag: boolean;
          assigned_therapist: string | null;
          acknowledged_by: string | null;
          response_time_minutes: number | null;
          created_at: string;
          acknowledged_at: string | null;
          in_progress_at: string | null;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          facility_id: string;
          room_id?: string | null;
          room_number?: string | null;
          resident_name?: string | null;
          request_type: string;
          priority: string;
          priority_score?: number;
          status?: string;
          notes?: string | null;
          ai_summary?: string | null;
          source: string;
          transcript?: string | null;
          ai_confidence?: number | null;
          detected_keywords?: string[] | null;
          safety_flag?: boolean;
          assigned_therapist?: string | null;
          acknowledged_by?: string | null;
          response_time_minutes?: number | null;
          created_at?: string;
          acknowledged_at?: string | null;
          in_progress_at?: string | null;
          resolved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["requests"]["Insert"]>;
      };
      request_events: {
        Row: {
          id: string;
          request_id: string;
          facility_id: string;
          event_type: string;
          actor_type: string;
          actor_name: string | null;
          old_status: string | null;
          new_status: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          facility_id: string;
          event_type: string;
          actor_type: string;
          actor_name?: string | null;
          old_status?: string | null;
          new_status?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["request_events"]["Insert"]>;
      };
      device_sessions: {
        Row: {
          id: string;
          facility_id: string;
          device_type: string;
          room_id: string | null;
          therapist_id: string | null;
          device_name: string | null;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          facility_id: string;
          device_type: string;
          room_id?: string | null;
          therapist_id?: string | null;
          device_name?: string | null;
          last_seen_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["device_sessions"]["Insert"]>;
      };
      leads: {
        Row: {
          id: string;
          kind: string;
          name: string | null;
          email: string | null;
          facility: string | null;
          role: string | null;
          rooms: string | null;
          message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          name?: string | null;
          email?: string | null;
          facility?: string | null;
          role?: string | null;
          rooms?: string | null;
          message?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
      };
    };
  };
};
