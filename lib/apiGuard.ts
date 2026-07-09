/**
 * Lightweight request guards for the money-spending API routes (/api/ai,
 * /api/voice). These proxy to paid third-party APIs, so an unauthenticated
 * public URL is a credit-burn vector.
 *
 * Two layers, both fail-safe:
 *   1. sameOriginOk() — reject browser calls embedded from other sites.
 *   2. rateLimit()    — cap requests per client IP (sliding window, in-memory).
 *
 * Notes / limits:
 *   - In-memory state is per-serverless-instance on Vercel, so this is a first
 *     layer, not a distributed limiter. For hard guarantees add Upstash Ratelimit
 *     (see SECURITY_AUDIT.md).
 *   - Callers should degrade GRACEFULLY when a limit trips (return
 *     { available: false } so the client falls back to the deterministic engine)
 *     — never block a patient's safety-critical triage.
 */

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

/** True if the request may proceed; false if the per-key window is exhausted. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Reject cross-site browser calls. A same-origin fetch from our own frontend
 * sends an Origin whose host equals the request Host. Server-to-server / curl
 * calls send no Origin — we allow those through so legitimate non-browser use
 * isn't broken, and rely on rateLimit() to bound abuse from that path.
 * LAN dev (192.168.x / 10.x) and Vercel preview domains are allowlisted.
 */
export function sameOriginOk(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser; bounded by rate limit
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const reqHost = req.headers.get("host") ?? "";
  if (host === reqHost) return true;
  const bare = host.split(":")[0]!;
  return (
    bare === "localhost" ||
    bare.endsWith(".vercel.app") ||
    /^192\.168\./.test(bare) ||
    /^10\./.test(bare)
  );
}
