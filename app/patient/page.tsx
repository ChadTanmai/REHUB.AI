"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPatientSession, clearPatientSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { useMounted, useStoreVersion } from "@/lib/useRehub";

type AppView = "home" | "settings" | "change-room";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any;

export default function PatientPage() {
  const mounted = useMounted();
  const router = useRouter();
  useStoreVersion();

  const [view, setView] = useState<AppView>("home");
  const [pressing, setPressing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [listening, setListening] = useState(false);
  const [pulseSize, setPulseSize] = useState(1);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  // Pulse animation while recording
  useEffect(() => {
    if (!recording) { setPulseSize(1); return; }
    const id = setInterval(() => {
      setPulseSize(s => s === 1 ? 1.08 : 1);
    }, 700);
    return () => clearInterval(id);
  }, [recording]);

  if (!mounted) return <div className="min-h-screen bg-navy" />;

  const session = getPatientSession();
  if (!session) {
    if (typeof window !== "undefined") router.replace("/join");
    return <div className="min-h-screen bg-navy" />;
  }

  const { facilityId, roomId } = session;
  const store = getStore();
  const ws = store.getWorkspace(facilityId);
  const room = ws.rooms.find(r => r.id === roomId);

  function handlePressStart() {
    setPressing(true);
    pressTimer.current = setTimeout(() => {
      startVoice();
    }, 400);
  }

  function handlePressEnd() {
    setPressing(false);
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (!recording) {
      // Short press → simple help request
      sendRequest("Button", "");
    }
  }

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SRClass = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SRClass) {
      sendRequest("Button", "");
      return;
    }
    const rec = new SRClass();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = Array.from(e.results as unknown[]).map((r: unknown) => (r as SpeechRecognitionResult)[0].transcript).join(" ");
      setTranscript(t);
    };
    rec.onend = () => {
      setRecording(false);
      setListening(false);
      const final = transcript;
      if (final.trim()) sendRequest("Voice", final);
      else sendRequest("Button", "");
    };
    rec.onerror = () => {
      setRecording(false);
      setListening(false);
      sendRequest("Button", "");
    };
    rec.start();
    setRecording(true);
    setListening(true);
  }

  function stopVoice() {
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
    }
    setRecording(false);
    setListening(false);
  }

  function sendRequest(source: "Button" | "Voice" | "Typed", text: string) {
    if (!room) return;
    store.submitRequest({
      facilityId,
      roomId,
      source,
      text: text || undefined,
    });
    setSubmitted(true);
    setTranscript("");
    setTimeout(() => setSubmitted(false), 4000);
  }

  function handleLeave() {
    clearPatientSession();
    router.replace("/join");
  }

  // ── Settings overlay ──────────────────────────────────────────────────────
  if (view === "settings") {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <header className="border-b border-gray-muted px-5 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setView("home")}
              className="flex items-center gap-1.5 text-sm font-medium text-teal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <p className="font-semibold text-navy">Settings</p>
            <div className="w-12" />
          </div>
        </header>
        <div className="flex-1 divide-y divide-gray-muted">
          {[
            { label: "My Room", value: `Room ${session.roomNumber}` },
            { label: "Facility", value: session.facilityName },
            { label: "My Name", value: session.patientName },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between px-5 py-4">
              <span className="text-sm font-medium text-slate">{row.label}</span>
              <span className="text-sm font-semibold text-navy">{row.value}</span>
            </div>
          ))}
          <div className="px-5 py-4">
            <button onClick={handleLeave}
              className="w-full rounded-xl border border-coral/30 py-3 text-sm font-semibold text-coral hover:bg-coral/5">
              Leave facility
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main patient home ─────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-navy select-none">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 pt-6">
        <div>
          <p className="text-sm font-medium text-white/50">Room {session.roomNumber}</p>
          <p className="text-lg font-bold text-white">Hello, {session.patientName.split(" ")[0]}</p>
        </div>
        <button onClick={() => setView("settings")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Main button area */}
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        {submitted ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-success/20">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-white">Request sent!</p>
            <p className="text-lg text-white/60">Your care team is on the way.</p>
          </div>
        ) : recording ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div
              className="flex h-48 w-48 items-center justify-center rounded-full bg-teal/20 transition-transform"
              style={{ transform: `scale(${pulseSize})` }}
            >
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#38b2ac" strokeWidth="1.5">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-white">Listening…</p>
              {transcript && <p className="mt-2 text-base text-white/60">"{transcript}"</p>}
            </div>
            <button onClick={stopVoice}
              className="mt-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Done speaking
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 text-center">
            <p className="text-lg font-medium text-white/60">
              {session.facilityName}
            </p>

            {/* THE BIG BUTTON */}
            <button
              onPointerDown={handlePressStart}
              onPointerUp={handlePressEnd}
              onPointerLeave={() => { setPressing(false); if (pressTimer.current) clearTimeout(pressTimer.current); }}
              className="relative flex h-56 w-56 flex-col items-center justify-center rounded-full bg-teal shadow-[0_0_60px_rgba(56,178,172,0.4)] transition-transform active:scale-95"
              style={{ transform: pressing ? "scale(0.96)" : "scale(1)", transition: "transform 0.1s" }}
              aria-label="Talk to staff"
            >
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                <path d="M15.05 5A5 5 0 0119 8.95M15.05 1A9 9 0 0123 8.94M1 1v4l2.99 1L7 8.99C8.44 10.44 10 11 12 11c2 0 3.56-.56 5-1.01L20 7l3-1V1" />
                <path d="M21 15c0 2.67-5.37 5-9 5s-9-2.33-9-5" />
              </svg>
              <p className="mt-3 text-xl font-bold text-white">Talk to Staff</p>
              <p className="mt-1 text-sm text-white/70">Press and hold to speak</p>
            </button>

            <p className="text-sm text-white/40">
              Press once for immediate help · Hold to speak
            </p>
          </div>
        )}
      </main>

      {/* Bottom facility name */}
      <footer className="pb-8 text-center">
        <p className="text-xs text-white/20">{session.facilityName} · Room {session.roomNumber}</p>
      </footer>
    </div>
  );
}
