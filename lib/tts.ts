"use client";

/**
 * Production text-to-speech for the patient device.
 *
 * Tries ElevenLabs natural voice via the secure /api/voice route first.
 * Falls back to the browser's built-in Web Speech API automatically — so
 * the device always has a voice even without an API key, and upgrades to
 * natural speech the moment ELEVENLABS_API_KEY is set in Vercel.
 *
 * Mobile browsers (especially iOS Safari) only allow audio after a user
 * gesture. Call primeTTS() from inside the talk-button tap; that unlocks
 * both Web Speech and AudioContext so later speak() calls autoplay.
 */

let primed = false;
let audioCtx: AudioContext | null = null;

/** Which voice actually spoke the last utterance — lets a caller show a status affordance if it wants one. */
export type VoiceMode = "natural" | "browser" | "silent";
let lastVoiceMode: VoiceMode = "silent";
export function getLastVoiceMode(): VoiceMode {
  return lastVoiceMode;
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Call from inside a user gesture to unlock both Web Speech and AudioContext. */
export function primeTTS(): void {
  if (primed) return;
  primed = true;
  // Unlock Web Speech
  if (ttsSupported()) {
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }
  // Unlock AudioContext (needed for ElevenLabs MP3 playback on iOS)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.001);
  } catch { /* ignore */ }
}

/**
 * Speak text aloud with a natural, warm voice.
 *
 * Tries ElevenLabs via /api/voice first (requires ELEVENLABS_API_KEY in Vercel).
 * Falls back to browser Web Speech automatically. Safe to fire-and-forget
 * with `void speak(text)` — or await if ordering matters.
 */
export async function speak(text: string): Promise<void> {
  if (!text.trim()) return;
  if (await tryElevenLabs(text)) {
    lastVoiceMode = "natural";
    return;
  }
  lastVoiceMode = ttsSupported() ? "browser" : "silent";
  speakBrowser(text);
}

/** One attempt at the ElevenLabs request/response call, with a 7s timeout. */
async function elevenLabsAttempt(text: string): Promise<ArrayBuffer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.headers.get("Content-Type")?.includes("audio")) return null;
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

/** Retries once on a transient failure (network error, timeout, 5xx) before giving up to the browser fallback. */
async function tryElevenLabs(text: string): Promise<boolean> {
  try {
    let buf = await elevenLabsAttempt(text).catch(() => null);
    if (!buf) buf = await elevenLabsAttempt(text).catch(() => null);
    if (!buf) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return false;
    const ctx = audioCtx ?? new Ctx();
    audioCtx = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const decoded = await ctx.decodeAudioData(buf);
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.connect(ctx.destination);
    src.start();
    return true;
  } catch {
    return false;
  }
}

function speakBrowser(text: string): void {
  if (!ttsSupported()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 1.15;
    u.volume = 1;
    u.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en[-_]US/i.test(v.lang) && /samantha|ava|allison|karen|moira|google us english|female/i.test(v.name))
      ?? voices.find((v) => /en[-_]US/i.test(v.lang))
      ?? voices.find((v) => /^en/i.test(v.lang));
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
