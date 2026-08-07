/**
 * Secure server-side text-to-speech via ElevenLabs.
 *
 * The browser never sees the key. The patient device posts { text } and gets
 * back natural-sounding MP3 audio. With no key configured the route returns
 * { available: false } and the client falls back to the browser's built-in
 * voice — so it keeps working until you add ELEVENLABS_API_KEY in Vercel, then
 * upgrades automatically.
 *
 * Defaults to a warm female voice ("Sarah") and the cheap, fast Flash model so
 * it sits comfortably in the free tier. Override with ELEVENLABS_VOICE_ID /
 * ELEVENLABS_MODEL_ID.
 *
 * KILL SWITCH: even with a key present, ElevenLabs stays OFF unless
 * ELEVENLABS_ENABLED is explicitly "true". This protects the free-tier
 * character budget — flip it on only for live facility demos, off afterward.
 * When off, the client transparently uses the free browser voice.
 */

import { sameOriginOk, rateLimit, clientIp } from "@/lib/apiGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL"; // "Sarah" — warm female
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5";   // fast + cheap

/**
 * GET → remaining ElevenLabs character quota, for the admin/diagnostics view.
 * Never returns the key itself, only usage numbers. Same-origin only so it
 * can't be scraped cross-site.
 */
export async function GET(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  const enabled = process.env.ELEVENLABS_ENABLED === "true";
  if (!sameOriginOk(req)) return Response.json({ available: false }, { status: 403 });
  if (!key) return Response.json({ available: false, reason: "No ELEVENLABS_API_KEY configured." });
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": key },
    });
    if (!r.ok) {
      return Response.json({ available: false, reason: `ElevenLabs ${r.status}` }, { status: 502 });
    }
    const s = await r.json();
    const used = Number(s.character_count ?? 0);
    const limit = Number(s.character_limit ?? 0);
    return Response.json({
      available: true,
      enabled,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      percentUsed: limit ? Math.round((used / limit) * 1000) / 10 : null,
      tier: s.tier ?? "unknown",
      resetsAt: s.next_character_count_reset_unix
        ? new Date(s.next_character_count_reset_unix * 1000).toISOString()
        : null,
    });
  } catch (e) {
    return Response.json(
      { available: false, reason: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  const enabled = process.env.ELEVENLABS_ENABLED === "true";
  // No key, or the kill switch is off → report unavailable so the client falls
  // back to the free browser voice and we spend zero ElevenLabs characters.
  if (!key || !enabled) return Response.json({ available: false });
  // Guard the paid TTS endpoint: cross-site → reject; over-rate → graceful
  // fallback to the browser voice. Tighter than /api/ai (voice isn't safety-
  // critical and costs ElevenLabs characters).
  if (!sameOriginOk(req)) return Response.json({ available: false }, { status: 403 });
  if (!rateLimit(`voice:${clientIp(req)}`, 30, 60_000)) return Response.json({ available: false });

  let text = "";
  try {
    const body = await req.json();
    text = String(body.text ?? "").slice(0, 400);
  } catch {
    return Response.json({ available: true, error: "Invalid JSON" }, { status: 400 });
  }
  if (!text.trim()) return Response.json({ available: true, error: "Empty text" }, { status: 400 });

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
        }),
      },
    );
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return Response.json({ available: true, error: `ElevenLabs ${r.status}: ${detail.slice(0, 200)}` }, { status: 502 });
    }
    const audio = await r.arrayBuffer();
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json({ available: true, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
