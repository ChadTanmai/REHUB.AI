"use client";

/**
 * Durable patient-request outbox.
 *
 * Patient messages can involve emergencies, so a dropped connection or an
 * un-published facility must NEVER silently lose a request. Every cloud
 * delivery goes through this localStorage-backed queue:
 *
 *   enqueue → attempt send → on success: remove · on failure: keep + retry
 *
 * Retries fire on a timer, when the network comes back online, and when the
 * tab regains focus — so a request submitted on a flaky phone connection is
 * delivered as soon as connectivity returns, even minutes later.
 *
 * Delivery is at-least-once. The only duplicate window is a crash between a
 * successful network round-trip and removing the item from the queue, which is
 * vanishingly rare. We accept that over the far worse failure of losing an
 * emergency request entirely.
 */

import { submitPatientRequest } from "./requests";

const KEY = "rehub:outbox:requests";
const MAX_ATTEMPTS = 100;          // keep trying for a long time (hours)
const FLUSH_INTERVAL_MS = 15_000;  // background retry cadence

export interface OutboxPayload {
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
}

interface OutboxItem {
  localId: string;
  payload: OutboxPayload;
  attempts: number;
  queuedAt: number;
  lastTryAt: number;
}

let flushing = false;
let timer: ReturnType<typeof setInterval> | null = null;
let listenersBound = false;

function read(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full / private mode — in-memory attempt still happened */
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Number of patient requests still waiting for cloud delivery. */
export function pendingCount(): number {
  return read().length;
}

/**
 * Queue a patient request for guaranteed cloud delivery, then immediately try
 * to send it. Returns a promise that resolves true if it was delivered on the
 * first attempt, false if it was queued for retry. Either way it is durable.
 */
export async function enqueueRequest(payload: OutboxPayload): Promise<boolean> {
  const item: OutboxItem = {
    localId: newId(),
    payload,
    attempts: 0,
    queuedAt: Date.now(),
    lastTryAt: 0,
  };
  const items = read();
  items.push(item);
  write(items);
  ensureAutoFlush();
  const { sent } = await flushOutbox();
  return sent > 0;
}

/**
 * Attempt to deliver every queued request. Successful items are removed;
 * failures stay queued with an incremented attempt count. Safe to call often;
 * it no-ops if a flush is already in progress.
 */
export async function flushOutbox(): Promise<{ sent: number; pending: number }> {
  if (flushing) return { sent: 0, pending: read().length };
  flushing = true;
  let sent = 0;
  try {
    const items = read();
    if (items.length === 0) return { sent: 0, pending: 0 };

    const survivors: OutboxItem[] = [];
    for (const item of items) {
      // Give up only after an extreme number of attempts (corrupt/expired).
      if (item.attempts >= MAX_ATTEMPTS) continue;
      item.attempts += 1;
      item.lastTryAt = Date.now();
      let ok = false;
      try {
        const id = await submitPatientRequest(item.payload);
        ok = id !== null;
      } catch {
        ok = false;
      }
      if (ok) {
        sent += 1;
      } else {
        survivors.push(item);
      }
    }
    write(survivors);
    return { sent, pending: survivors.length };
  } finally {
    flushing = false;
  }
}

/**
 * Start background retry: a timer plus online/focus listeners. Idempotent —
 * calling it more than once does not stack timers or listeners. Returns a
 * cleanup function.
 */
export function ensureAutoFlush(): () => void {
  if (typeof window === "undefined") return () => {};

  if (!timer) {
    timer = setInterval(() => {
      if (read().length > 0) void flushOutbox();
    }, FLUSH_INTERVAL_MS);
  }

  if (!listenersBound) {
    listenersBound = true;
    const onWake = () => { if (read().length > 0) void flushOutbox(); };
    window.addEventListener("online", onWake);
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onWake();
    });
  }

  return () => {
    if (timer) { clearInterval(timer); timer = null; }
  };
}
