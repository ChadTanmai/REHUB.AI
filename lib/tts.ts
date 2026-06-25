"use client";

/**
 * Production text-to-speech for the patient device.
 *
 * Mobile browsers (especially iOS Safari) only allow speech synthesis after a
 * user gesture. The patient taps the big circle to talk, so we "prime" the
 * engine on that tap; later, when the nurse acknowledges, speak() works without
 * any extra tap from the patient.
 */

let primed = false;

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Call from inside a user gesture (e.g. the talk button) to unlock TTS. */
export function primeTTS(): void {
  if (primed || !ttsSupported()) return;
  try {
    // Speaking an empty utterance inside the gesture unlocks autoplay policy.
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    primed = true;
  } catch {
    /* ignore */
  }
}

/** Speak a phrase aloud. No-op if unsupported. */
export function speak(text: string): void {
  if (!ttsSupported() || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    // Warm, friendly delivery: a touch slower and a little higher pitched reads
    // as caring rather than robotic — reassuring for an anxious patient.
    u.rate = 0.9;
    u.pitch = 1.15;
    u.volume = 1;
    u.lang = "en-US";
    // Prefer a warm, natural English voice when one is available.
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en[-_]US/i.test(v.lang) && /samantha|ava|allison|karen|moira|google us english|female/i.test(v.name))
      ?? voices.find((v) => /en[-_]US/i.test(v.lang))
      ?? voices.find((v) => /^en/i.test(v.lang));
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}
