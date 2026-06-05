/**
 * Browser voice helpers for the resident/room screen.
 *
 *   - Speech-to-text via the Web Speech API (SpeechRecognition), when available.
 *   - Live microphone amplitude via the Web Audio API, used to gently scale the
 *     listening bubble.
 *
 * Privacy: nothing is recorded continuously and nothing is sent to any external
 * API. The microphone only opens after an explicit tap and closes on stop.
 */

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition,
  );
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export interface SpeechSession {
  stop: () => void;
}

export interface SpeechHandlers {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

/** Start speech recognition. Returns a session handle, or null if unsupported. */
export function startSpeechRecognition(handlers: SpeechHandlers): SpeechSession | null {
  if (!isSpeechRecognitionSupported()) return null;

  const Ctor =
    (window as unknown as Record<string, new () => SpeechRecognitionLike>)
      .SpeechRecognition ||
    (window as unknown as Record<string, new () => SpeechRecognitionLike>)
      .webkitSpeechRecognition;

  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = true;

  let finalText = "";

  recognition.onresult = (e) => {
    let interim = "";
    for (let i = 0; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      // The final flag isn't typed on our minimal shape; treat last as final.
      interim += transcript;
    }
    finalText = interim;
    handlers.onInterim?.(interim);
  };

  recognition.onerror = (e) => handlers.onError?.(e.error);
  recognition.onend = () => {
    if (finalText.trim()) handlers.onFinal(finalText.trim());
    handlers.onEnd?.();
  };

  recognition.start();
  return { stop: () => recognition.stop() };
}

export interface AmplitudeMeter {
  stop: () => void;
}

/**
 * Open the microphone and call `onLevel` with a normalized 0..1 amplitude on
 * each animation frame. Returns a meter handle (call stop() to release the mic),
 * or null if microphone access fails.
 */
export async function startAmplitudeMeter(
  onLevel: (level: number) => void,
): Promise<AmplitudeMeter | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return null;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext;
    const audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      analyser.getByteTimeDomainData(data);
      // RMS around the 128 midpoint → normalized loudness.
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / data.length);
      onLevel(Math.min(1, rms * 3.2)); // scale so normal speech reads ~0.4–0.8
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return {
      stop: () => {
        stopped = true;
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close().catch(() => {});
      },
    };
  } catch {
    return null;
  }
}

/** Map a 0..1 amplitude to the bubble scale range (1.0 → 1.18). */
export function amplitudeToScale(level: number): number {
  return 1 + Math.min(0.18, level * 0.18);
}
