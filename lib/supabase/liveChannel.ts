"use client";

/**
 * Live voice streaming via Supabase Realtime Broadcast.
 *
 * Partial transcripts must reach the nurse as the patient speaks (<~300ms),
 * with no "record → upload → transcribe → send" delay. Broadcast is ephemeral
 * (no database write, no RLS/postgres_changes round-trip), so it is the right
 * transport for live captions — the same pattern as live cursors / live
 * captions in collaborative apps.
 *
 * The durable patient_messages row is still written when the patient finishes
 * (see outbox) — Broadcast is the live layer, the DB is the system of record.
 */

import { getAuthClient } from "@/lib/auth/supabase-browser";

export interface LiveSpeakingPayload {
  roomId: string;
  roomNumber: string;
  residentName: string;
  transcript: string;
  speaking: boolean;
  urgencyLevel: string | null;
  ts: number;
}

const TOPIC = (facilityId: string) => `live:${facilityId}`;
const EVENT = "speaking";

/**
 * Patient side: open a broadcaster for live speech. Call send() on each interim
 * transcript update; call close() when done. Returns immediately; sends are
 * queued by the client until the channel is joined.
 */
export function openLiveBroadcaster(facilityId: string): {
  send: (p: LiveSpeakingPayload) => void;
  close: () => void;
} {
  const supabase = getAuthClient();
  const channel = supabase.channel(TOPIC(facilityId), {
    config: { broadcast: { self: false, ack: false } },
  });
  channel.subscribe();
  return {
    send: (p) => {
      try {
        channel.send({ type: "broadcast", event: EVENT, payload: p });
      } catch {
        /* not joined yet / transport hiccup — live layer is best-effort */
      }
    },
    close: () => {
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    },
  };
}

/**
 * Nurse side: subscribe to live speech updates for the facility. Fires for every
 * partial transcript from any room. Returns an unsubscribe function.
 */
export function subscribeLiveSpeaking(
  facilityId: string,
  onUpdate: (p: LiveSpeakingPayload) => void,
): () => void {
  const supabase = getAuthClient();
  const channel = supabase
    .channel(TOPIC(facilityId), { config: { broadcast: { self: false } } })
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "broadcast" as any,
      { event: EVENT },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (msg: any) => {
        if (msg?.payload) onUpdate(msg.payload as LiveSpeakingPayload);
      },
    )
    .subscribe();
  return () => { try { supabase.removeChannel(channel); } catch { /* ignore */ } };
}
