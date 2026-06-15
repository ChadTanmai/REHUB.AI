/**
 * Cross-device real-time sync — no Supabase required.
 *
 * GET  /api/sync?facilityId=xxx  → SSE stream: pushes "ping" events when the
 *      server's in-memory workspace changes for that facility.
 * POST /api/sync                 → receives a workspace snapshot from any device
 *      and fans it out to all SSE subscribers for that facility.
 *
 * This lets every phone, tablet, and laptop on the same WiFi network stay in
 * sync through the Next.js dev (or production) server acting as the hub.
 *
 * Architecture:
 *   Room tablet submits request → POST /api/sync with new snapshot
 *   Server fans out SSE ping to all subscribers
 *   Therapist dashboard receives ping → re-fetches snapshot from GET /api/sync/state
 *
 * No persistent storage here — the canonical source is still localStorage on
 * each device. The server is a pure message broker for cross-device fan-out.
 */

import { NextRequest } from "next/server";

// In-memory subscriber registry (per Node.js process).
// Maps facilityId → Set of SSE response controllers.
const subscribers = new Map<string, Set<ReadableStreamDefaultController>>();

// In-memory workspace snapshots (latest per facility).
const snapshots = new Map<string, string>(); // facilityId → JSON string

function addSubscriber(
  facilityId: string,
  controller: ReadableStreamDefaultController,
) {
  if (!subscribers.has(facilityId)) subscribers.set(facilityId, new Set());
  subscribers.get(facilityId)!.add(controller);
}

function removeSubscriber(
  facilityId: string,
  controller: ReadableStreamDefaultController,
) {
  subscribers.get(facilityId)?.delete(controller);
}

function broadcast(facilityId: string, event: string) {
  const subs = subscribers.get(facilityId);
  if (!subs || subs.size === 0) return;
  const msg = `data: ${event}\n\n`;
  const dead: ReadableStreamDefaultController[] = [];
  for (const ctrl of subs) {
    try {
      ctrl.enqueue(msg);
    } catch {
      dead.push(ctrl);
    }
  }
  dead.forEach((ctrl) => subs.delete(ctrl));
}

// ── GET — SSE subscription ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const facilityId = req.nextUrl.searchParams.get("facilityId") ?? "fac-demo";
  const snapshot = req.nextUrl.searchParams.get("snapshot");

  // ?snapshot=1 just returns the latest snapshot as JSON (for polling fallback).
  if (snapshot === "1") {
    const data = snapshots.get(facilityId) ?? "null";
    return new Response(data, {
      headers: { "Content-Type": "application/json" },
    });
  }

  // SSE stream.
  let controller: ReadableStreamDefaultController;
  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      addSubscriber(facilityId, controller);
      // Send initial "connected" event.
      ctrl.enqueue(`data: connected\n\n`);
      // Send current snapshot immediately if we have one.
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
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ── POST — broadcast a workspace update ───────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { facilityId: string; workspace: unknown };
    const { facilityId, workspace } = body;
    if (!facilityId || !workspace) {
      return new Response("Missing facilityId or workspace", { status: 400 });
    }
    // Store snapshot and fan out.
    const json = JSON.stringify(workspace);
    snapshots.set(facilityId, json);
    broadcast(facilityId, json);
    return new Response("ok");
  } catch {
    return new Response("Bad request", { status: 400 });
  }
}
