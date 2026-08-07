"use client";

/**
 * Rehub's signature notification chime.
 *
 * Synthesized with the Web Audio API rather than shipped as an audio file: no
 * network fetch (so it still sounds on a flaky facility network), no asset to
 * cache-bust, and each note gets a proper attack/decay envelope so it reads as
 * a chime rather than the harsh square-wave "beep" this replaces.
 *
 * Two distinct voices, because a nurse needs to tell them apart from across a
 * room without looking:
 *   • newRequest — a gentle ascending major triad. Pleasant, non-alarming.
 *   • critical   — a faster, brighter, repeating figure that clearly reads as
 *                  "go now". Deliberately more insistent, never a klaxon.
 *
 * Browsers block audio until the user has interacted with the page, so
 * primeChime() must be called from inside a real user gesture (a click) once
 * per session — see ChimePrimer / the dashboard mount.
 */

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return null;
    // One long-lived context: creating one per sound leaks handles and
    // eventually throws once the browser's context limit is hit.
    if (!ctx) ctx = new Ctx();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Unlock audio from inside a user gesture. Safe to call repeatedly. */
export function primeChime(): void {
  const c = audioCtx();
  if (!c) return;
  try {
    // A silent 1-frame blip satisfies the autoplay gate on iOS/Safari.
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch { /* ignore */ }
}

/** One bell-like note: sine fundamental + quieter octave for a metallic sheen. */
function note(c: AudioContext, freq: number, startAt: number, dur: number, peak: number): void {
  for (const [mult, level] of [[1, peak], [2, peak * 0.28]] as const) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * mult;
    osc.connect(gain);
    gain.connect(c.destination);
    // Fast attack, exponential decay — the shape that reads as "struck bell".
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(level, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
    osc.start(startAt);
    osc.stop(startAt + dur + 0.02);
  }
}

/** Gentle ascending triad — a new request has arrived. */
export function chimeNewRequest(): void {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime;
  // C6 – E6 – G6: bright enough to carry over room noise, still musical.
  note(c, 1046.5, t, 0.42, 0.22);
  note(c, 1318.5, t + 0.11, 0.42, 0.20);
  note(c, 1568.0, t + 0.22, 0.60, 0.24);
}

/** Insistent repeating figure — a Critical request needs someone now. */
export function chimeCritical(): void {
  const c = audioCtx();
  if (!c) return;
  const t = c.currentTime;
  // Two urgent high-low pairs, then a held top note. Reads as "attention"
  // rather than "alarm" — nurses ignore klaxons, they respond to signals.
  const pattern: [number, number][] = [
    [1568.0, 0.00], [1174.7, 0.13],
    [1568.0, 0.28], [1174.7, 0.41],
  ];
  for (const [f, off] of pattern) note(c, f, t + off, 0.26, 0.30);
  note(c, 2093.0, t + 0.58, 0.75, 0.26);
}
