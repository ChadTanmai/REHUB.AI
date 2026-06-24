"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPatientSession, clearPatientSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { useMounted, useStoreVersion } from "@/lib/useRehub";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any;

type AppView = "home" | "settings";

export default function PatientPage() {
  const mounted = useMounted();
  const router = useRouter();
  useStoreVersion();

  const [view, setView] = useState<AppView>("home");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [amp, setAmp] = useState(0); // 0..1 live voice amplitude

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    return () => stopEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return <div className="min-h-screen" style={{ background: "#F5F1E8" }} />;

  const session = getPatientSession();
  if (!session) {
    if (typeof window !== "undefined") router.replace("/join");
    return <div className="min-h-screen" style={{ background: "#F5F1E8" }} />;
  }

  const { facilityId, roomId } = session;
  const store = getStore();
  const ws = store.getWorkspace(facilityId);
  const room = ws.rooms.find((r) => r.id === roomId);

  function stopMeter() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setAmp(0);
  }

  function stopEverything() {
    if (recRef.current) { try { recRef.current.stop(); } catch {} recRef.current = null; }
    stopMeter();
  }

  // Live microphone amplitude meter → drives the breathing animation.
  async function startMeter() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        // RMS around the 128 midpoint → 0..1
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Smooth + boost so quiet speech still shows.
        setAmp((prev) => prev * 0.6 + Math.min(1, rms * 3.2) * 0.4);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Mic permission denied — animation just won't pulse; speech may still work.
    }
  }

  function startListening() {
    setTranscript("");
    transcriptRef.current = "";
    setRecording(true);
    startMeter();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SRClass = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (SRClass) {
      const rec: SR = new SRClass();
      recRef.current = rec;
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        const t = Array.from(e.results as unknown[])
          .map((r: unknown) => (r as SpeechRecognitionResult)[0].transcript)
          .join(" ");
        transcriptRef.current = t;
        setTranscript(t);
      };
      rec.onerror = () => {};
      try { rec.start(); } catch {}
    }
  }

  function stopListening() {
    if (recRef.current) { try { recRef.current.stop(); } catch {} recRef.current = null; }
    stopMeter();
    setRecording(false);
    const finalText = transcriptRef.current.trim();
    sendRequest(finalText ? "Voice" : "Button", finalText);
  }

  function toggleTalk() {
    if (submitted) return;
    if (recording) stopListening();
    else startListening();
  }

  function sendRequest(source: "Button" | "Voice" | "Typed", text: string) {
    if (!room) return;
    store.submitRequest({ facilityId, roomId, source, text: text || undefined });
    setSubmitted(true);
    setTranscript("");
    transcriptRef.current = "";
    setTimeout(() => setSubmitted(false), 4500);
  }

  function handleLeave() {
    stopEverything();
    clearPatientSession();
    router.replace("/join");
  }

  const firstName = session.patientName.split(" ")[0];

  // ── Settings ───────────────────────────────────────────────────────────────
  if (view === "settings") {
    return (
      <div className="flex min-h-screen flex-col" style={{ background: "#F5F1E8" }}>
        <header className="px-5 py-4">
          <button onClick={() => setView("home")} className="flex items-center gap-1.5 text-sm font-semibold text-slate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        </header>
        <div className="mx-auto w-full max-w-md flex-1 px-5">
          <h1 className="mb-4 text-2xl font-bold text-navy">Settings</h1>
          <div className="divide-y divide-black/5 overflow-hidden rounded-2xl bg-white/70 shadow-soft">
            {[
              { label: "My room", value: `Room ${session.roomNumber}` },
              { label: "Facility", value: session.facilityName },
              { label: "My name", value: session.patientName },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-4">
                <span className="text-sm font-medium text-slate/70">{row.label}</span>
                <span className="text-sm font-semibold text-navy">{row.value}</span>
              </div>
            ))}
          </div>
          <button onClick={handleLeave}
            className="mt-4 w-full rounded-2xl border border-coral/30 bg-white/60 py-3.5 text-sm font-semibold text-coral hover:bg-coral/5">
            Leave facility
          </button>
        </div>
      </div>
    );
  }

  // ── Home ───────────────────────────────────────────────────────────────────
  // Animation scale: idle gentle pulse handled by CSS; while recording the ring
  // grows/shrinks with live voice amplitude.
  const ringScale = recording ? 1 + amp * 0.45 : 1;
  const glowOpacity = recording ? 0.35 + amp * 0.5 : 0.25;

  return (
    <div className="relative flex min-h-screen flex-col select-none overflow-hidden" style={{ background: "#F5F1E8" }}>
      {/* Top bar */}
      <header className="z-10 flex items-center justify-between px-5 pt-6">
        <div>
          <p className="text-sm font-medium text-slate/50">Room {session.roomNumber}</p>
          <p className="text-lg font-bold text-navy">Hello, {firstName}</p>
        </div>
        <button onClick={() => setView("settings")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-slate shadow-soft hover:bg-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Main */}
      <main className="z-10 flex flex-1 flex-col items-center justify-center px-6">
        {submitted ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full" style={{ background: "rgba(34,197,94,0.15)" }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-navy">Help is on the way</p>
            <p className="text-lg text-slate/60">Your care team has been notified.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <p className="mb-10 text-center text-lg font-medium text-slate/50">
              {recording ? "I'm listening…" : "Tap the circle to talk to staff"}
            </p>

            {/* THE BIG TAP-TO-TALK CIRCLE */}
            <button
              onClick={toggleTalk}
              aria-label="Talk to staff"
              className="relative flex items-center justify-center"
              style={{ width: 300, height: 300 }}
            >
              {/* Outer flowing glow rings */}
              <span
                className="absolute rounded-full transition-all duration-150 ease-out"
                style={{
                  width: 300, height: 300,
                  background: "radial-gradient(circle, rgba(56,178,172,0.45) 0%, rgba(56,178,172,0) 70%)",
                  transform: `scale(${ringScale + 0.15})`,
                  opacity: glowOpacity,
                }}
              />
              <span
                className={`absolute rounded-full border-2 transition-all duration-150 ease-out ${recording ? "" : "animate-[pulse_2.4s_ease-in-out_infinite]"}`}
                style={{
                  width: 260, height: 260,
                  borderColor: "rgba(56,178,172,0.35)",
                  transform: `scale(${ringScale})`,
                }}
              />
              {/* Core */}
              <span
                className="relative flex items-center justify-center rounded-full text-white shadow-[0_12px_40px_rgba(56,178,172,0.45)] transition-all duration-150 ease-out"
                style={{
                  width: 220, height: 220,
                  background: recording
                    ? "radial-gradient(circle at 50% 40%, #4fd1c5, #319795)"
                    : "radial-gradient(circle at 50% 40%, #3fc0b8, #2c9c97)",
                  transform: `scale(${recording ? 1 + amp * 0.12 : 1})`,
                }}
              >
                <span className="text-2xl font-bold tracking-tight">
                  {recording ? "Tap to send" : "Talk to Staff"}
                </span>
              </span>
            </button>

            {/* Live transcript */}
            <div className="mt-10 h-12 max-w-md text-center">
              {recording && transcript && (
                <p className="text-lg text-slate/70">&ldquo;{transcript}&rdquo;</p>
              )}
              {!recording && (
                <p className="text-sm text-slate/40">
                  Tap once to start talking · tap again to send
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Branding */}
      <footer className="z-10 pb-8 text-center">
        <p className="text-sm font-semibold tracking-wide text-slate/40">
          ReHub <span className="text-teal/60">AI</span>
        </p>
        <p className="mt-0.5 text-xs text-slate/30">{session.facilityName} · Room {session.roomNumber}</p>
      </footer>
    </div>
  );
}
