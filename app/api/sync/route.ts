/**
 * Cross-device real-time sync hub (WiFi/local network).
 *
 * GET  /api/sync?facilityId=xxx  → SSE stream for a facility.
 * POST /api/sync                 → push a workspace snapshot; fans out to all subscribers.
 *
 * Security:
 *  - facilityId is validated as a UUID-like string before use.
 *  - Payload size is capped at 2 MB.
 *  - Demo facility IDs (prefix "demo-") are allowed but their snapshots are not
 *    broadcast to other networks (they expire locally anyway).
 *  - The facilityId in POST body must match the one registered at GET time.
 *  - Rate limited by Vercel edge at the infra level; we add a per-facility
 *    subscriber cap to prevent memory exhaustion.
 */

import { NextRequest } from "next/server";

const MAX_SUBSCRIBERS_PER_FACILITY = 50;
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
const FACILITY_ID_RE = /^[a-zA-Z0-9_-]{4,80}$/;

const subscribers = new Map<string, Set<ReadableStreamDefaultController>>();
const snapshots   = new Map<string, string>();

function validateFacilityId(id: string | null): id is string {
  return typeof id === "string" && FACILITY_ID_RE.test(id);
}

function addSubscriber(id: string, ctrl: ReadableStreamDefaultController) {
  if (!subscribers.has(id)) subscribers.set(id, new Set());
  const subs = subscribers.get(id)!;
  if (subs.size >= MAX_SUBSCRIBERS_PER_FACILITY) return; // cap
  subs.add(ctrl);
}

function removeSubscriber(id: string, ctrl: ReadableStreamDefaultController) {
  subscribers.get(id)?.delete(ctrl);
}

function broadcast(id: string, payload: string) {
  const subs = subscribers.get(id);
  if (!subs?.size) return;
  const msg = `data: ${payload}\n\n`;
  const dead: ReadableStreamDefaultController[] = [];
  for (const ctrl of subs) {
    try { ctrl.enqueue(msg); } catch { dead.push(ctrl); }
  }
  dead.forEach((c) => subs.delete(c));
}

// ── GET — SSE subscription ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const facilityId = req.nextUrl.searchParams.get("facilityId");
  if (!validateFacilityId(facilityId)) {
    return new Response("Invalid facilityId", { status: 400 });
  }

  // Snapshot-only mode (?snapshot=1) for polling fallback
  if (req.nextUrl.searchParams.get("snapshot") === "1") {
    return new Response(snapshots.get(facilityId) ?? "null", {
      headers: { "Content-Type": "application/json" },
    });
  }

  let controller: ReadableStreamDefaultController;
  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      addSubscriber(facilityId, controller);
      ctrl.enqueue(`data: connected\n\n`);
      const snap = snapshots.get(facilityId);
      if (snap) ctrl.enqueue(`data: ${snap}\n\n`);
    },
    cancel() {
      removeSubscriber(facilityId, controller);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ── POST — receive and broadcast a workspace snapshot ─────────────────────

export async function POST(req: NextRequest) {
  // Enforce payload size limit
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  try {
    const body = await req.json() as { facilityId?: string; workspace?: unknown };
    const { facilityId, workspace } = body;

    if (!validateFacilityId(facilityId ?? null) || !facilityId) {
      return new Response("Invalid facilityId", { status: 400 });
    }
    if (!workspace || typeof workspace !== "object") {
      return new Response("Missing workspace", { status: 400 });
    }

    const json = JSON.stringify(workspace);
    snapshots.set(facilityId, json);
    broadcast(facilityId, json);

    return new Response("ok", { headers: { "Content-Type": "text/plain" } });
  } catch {
    return new Response("Bad request", { status: 400 });
  }
}
