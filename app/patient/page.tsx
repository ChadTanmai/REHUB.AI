"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPatientSession, clearPatientSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { enqueueRequest, ensureAutoFlush } from "@/lib/supabase/outbox";
import { getRequestStatus } from "@/lib/supabase/requests";
import { openLiveBroadcaster } from "@/lib/supabase/liveChannel";
import { classifyRequest } from "@/lib/aiClassifier";
import { primeTTS, speak } from "@/lib/tts";
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
  // Request flow: idle → sent (waiting for staff) → ack (acknowledged).
  const [flow, setFlow] = useState<"idle" | "sent" | "ack">("idle");
  const [ackBy, setAckBy] = useState<string | null>(null);
  // Typed fallback for browsers without speech recognition (e.g. some iOS).
  const [showTyping, setShowTyping] = useState(false);
  const [typedDraft, setTypedDraft] = useState("");
  const [sttError, setSttError] = useState("");
  // Pulses true briefly each time new speech arrives → drives the live animation.
  const [voiceActive, setVoiceActive] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const transcriptRef = useRef("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const liveRef = useRef<{ send: (p: import("@/lib/supabase/liveChannel").LiveSpeakingPayload) => void; close: () => void } | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep delivering any queued patient requests in the background (retry on
  // reconnect / focus). The timer is a module singleton, so no cleanup needed.
  useEffect(() => { ensureAutoFlush(); }, []);

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

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function stopEverything() {
    if (recRef.current) { try { recRef.current.stop(); } catch {} recRef.current = null; }
    stopPolling();
    closeLive(false);
    if (voiceTimerRef.current) { clearTimeout(voiceTimerRef.current); voiceTimerRef.current = null; }
  }

  // Brief "voice active" pulse (drives the live animation without a 2nd mic).
  function pulseVoice() {
    setVoiceActive(true);
    if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
    voiceTimerRef.current = setTimeout(() => setVoiceActive(false), 350);
  }

  // Push a live partial transcript to the nurse via Broadcast (best-effort).
  function broadcastLive(text: string, speaking: boolean) {
    if (!liveRef.current) return;
    const urgency = text.trim() ? classifyRequest(text).urgencyLevel ?? null : null;
    liveRef.current.send({
      roomId,
      roomNumber: session!.roomNumber,
      residentName: session!.patientName,
      transcript: text,
      speaking,
      urgencyLevel: urgency,
      ts: Date.now(),
    });
  }

  // Tell the nurse the patient stopped speaking, then tear down the channel.
  function closeLive(sendStop: boolean) {
    if (!liveRef.current) return;
    if (sendStop) broadcastLive(transcriptRef.current, false);
    liveRef.current.close();
    liveRef.current = null;
  }

  /**
   * Poll the cloud for this request's status until a nurse acknowledges (or a
   * timeout). When acknowledged, show + SPEAK the confirmation with the staff
   * name. RPC is anon-safe (security definer), so it works on the patient's
   * un-authenticated device on any network.
   */
  function startAckPolling(messageId: string) {
    stopPolling();
    pollStartRef.current = Date.now();
    const check = async () => {
      const info = await getRequestStatus(messageId);
      if (!info) {
        // Give up quietly after ~3 minutes if we never get a reading.
        if (Date.now() - pollStartRef.current > 180_000) stopPolling();
        return;
      }
      if (info.status === "Acknowledged" || info.status === "In Progress" || info.status === "Resolved") {
        stopPolling();
        const name = (info.acknowledgedBy ?? "").trim();
        setAckBy(name || null);
        setFlow("ack");
        const who = session!.patientName.split(" ")[0] || "there";
        speak(
          name
            ? `Hi ${who}! Good news — ${name} got your message and is on the way to help you. Hang tight, you're in good hands.`
            : `Hi ${who}! Good news — your care team got your message and is on the way to help you. Hang tight, you're in good hands.`,
        );
      }
    };
    void check();
    pollRef.current = setInterval(check, 3000);
  }

  function resetFlow() {
    stopPolling();
    setFlow("idle");
    setAckBy(null);
  }

  function startListening() {
    // Unlock text-to-speech inside this user gesture so the spoken nurse
    // confirmation can autoplay later without another tap.
    primeTTS();
    setTranscript("");
    transcriptRef.current = "";
    setSttError("");
    setTypedDraft("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SRClass = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SRClass) {
      // No speech recognition on this browser (common on iOS): typed fallback.
      setRecording(true);
      setShowTyping(true);
      return;
    }

    setRecording(true);
    setShowTyping(false);

    // Open the live broadcast channel so the nurse sees words as they're spoken.
    liveRef.current = openLiveBroadcaster(facilityId);
    broadcastLive("", true);

    // IMPORTANT: do NOT open a second microphone stream (getUserMedia) here.
    // On phones a second mic capture steals audio from SpeechRecognition and
    // you get an empty transcript. SpeechRecognition owns the mic alone.
    const rec: SR = new SRClass();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false; // mobile-friendly: continuous is unreliable on iOS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = Array.from(e.results as unknown[])
        .map((r: unknown) => (r as SpeechRecognitionResult)[0].transcript)
        .join(" ");
      transcriptRef.current = t;
      setTranscript(t);
      pulseVoice();
      // Stream the partial transcript to the nurse immediately (no DB write).
      broadcastLive(t, true);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      const err = e?.error ?? "unknown";
      // no-speech / aborted are benign; for real failures offer typing.
      if (err !== "no-speech" && err !== "aborted") {
        setSttError(err === "not-allowed" ? "Microphone permission was blocked." : `Voice error: ${err}`);
        setShowTyping(true);
      }
    };
    try {
      rec.start();
    } catch {
      setSttError("Couldn't start the microphone.");
      setShowTyping(true);
    }
  }

  function stopListening() {
    if (recRef.current) { try { recRef.current.stop(); } catch {} recRef.current = null; }
    closeLive(true);
    setVoiceActive(false);
    setRecording(false);
    setShowTyping(false);
    const finalText = transcriptRef.current.trim();
    sendRequest(finalText ? "Voice" : "Button", finalText);
  }

  function sendTyped() {
    const text = typedDraft.trim();
    if (recRef.current) { try { recRef.current.stop(); } catch {} recRef.current = null; }
    closeLive(true);
    setVoiceActive(false);
    setRecording(false);
    setShowTyping(false);
    setTypedDraft("");
    sendRequest(text ? "Typed" : "Button", text);
  }

  function toggleTalk() {
    if (flow !== "idle") return;
    if (recording) stopListening();
    else startListening();
  }

  function sendRequest(source: "Button" | "Voice" | "Typed", text: string) {
    if (!room) return;
    const req = store.submitRequest({ facilityId, roomId, source, text: text || undefined });
    // Deliver to the nurse command center via the durable outbox: it retries on
    // a dropped connection / focus / reconnect so an emergency request is never
    // silently lost. When delivered, we get the cloud id back and start polling
    // for the nurse's acknowledgement.
    void enqueueRequest(
      {
        facilityCode: session!.facilityCode,
        roomId: req.roomId,
        roomNumber: req.roomNumber,
        residentName: req.residentName,
        text: req.transcript ?? "",
        source: req.source,
        requestType: req.requestType,
        priority: req.priority,
        urgencyLevel: req.urgencyLevel ?? "Medium",
        triageReason: req.triageReason ?? "",
        suggestedAction: req.suggestedAction ?? "",
      },
      (remoteId) => startAckPolling(remoteId),
    );
    setFlow("sent");
    setAckBy(null);
    setTranscript("");
    transcriptRef.current = "";
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
  // Animation: a gentle CSS pulse (no live mic meter — a second mic stream
  // breaks speech recognition on phones). Faster pulse while recording.
  const glowOpacity = recording ? 0.4 : 0.25;

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
        {flow === "ack" ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full" style={{ background: "rgba(34,197,94,0.18)" }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-bold uppercase tracking-widest text-success">Request received</p>
            <p className="text-3xl font-bold text-navy">
              {ackBy ? `${ackBy} is on the way` : "Your care team is on the way"}
            </p>
            <p className="text-lg text-slate/60">Someone is coming to assist you now.</p>
            <button onClick={resetFlow}
              className="mt-2 rounded-2xl bg-navy px-7 py-3 text-base font-semibold text-white hover:bg-[#0c2030]">
              Done
            </button>
          </div>
        ) : flow === "sent" ? (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full" style={{ background: "rgba(56,178,172,0.15)" }}>
              <span className="h-12 w-12 animate-spin rounded-full border-4 border-teal/30 border-t-teal" />
            </div>
            <p className="text-3xl font-bold text-navy">Help is on the way</p>
            <p className="text-lg text-slate/60">Your care team has been notified.</p>
            <p className="text-sm text-slate/40">Waiting for staff to respond…</p>
            <button onClick={resetFlow}
              className="mt-2 rounded-2xl border border-slate/20 bg-white/60 px-7 py-3 text-base font-semibold text-slate hover:bg-white">
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <p className="mb-10 text-center text-lg font-medium text-slate/50">
              {showTyping ? "Type your message to staff" : recording ? "I'm listening…" : "Tap the circle to talk to staff"}
            </p>

            {/* THE BIG TAP-TO-TALK CIRCLE */}
            <button
              onClick={toggleTalk}
              aria-label="Talk to staff"
              className="relative flex items-center justify-center"
              style={{ width: 300, height: 300 }}
            >
              {/* Outer glow */}
              <span
                className={`absolute rounded-full ${recording ? "animate-[pulse_1.4s_ease-in-out_infinite]" : "animate-[pulse_2.6s_ease-in-out_infinite]"}`}
                style={{
                  width: 300, height: 300,
                  background: "radial-gradient(circle, rgba(56,178,172,0.45) 0%, rgba(56,178,172,0) 70%)",
                  opacity: glowOpacity,
                }}
              />
              {/* Border ring */}
              <span
                className={`absolute rounded-full border-2 ${recording ? "animate-[ping_1.6s_ease-in-out_infinite]" : "animate-[pulse_2.6s_ease-in-out_infinite]"}`}
                style={{ width: 260, height: 260, borderColor: "rgba(56,178,172,0.35)" }}
              />
              {/* Core — scales up briefly as words arrive (voice-reactive) */}
              <span
                className="relative flex items-center justify-center rounded-full text-white shadow-[0_12px_40px_rgba(56,178,172,0.45)] transition-transform duration-200 ease-out"
                style={{
                  width: 220, height: 220,
                  background: recording
                    ? "radial-gradient(circle at 50% 40%, #4fd1c5, #319795)"
                    : "radial-gradient(circle at 50% 40%, #3fc0b8, #2c9c97)",
                  transform: `scale(${voiceActive ? 1.08 : recording ? 1.02 : 1})`,
                }}
              >
                <span className="text-2xl font-bold tracking-tight">
                  {recording ? "Tap to send" : "Talk to Staff"}
                </span>
              </span>
            </button>

            {/* Live transcript */}
            <div className="mt-8 min-h-12 max-w-md text-center">
              {recording && !showTyping && transcript && (
                <p className="text-lg text-slate/70">&ldquo;{transcript}&rdquo;</p>
              )}
              {!recording && !sttError && (
                <p className="text-sm text-slate/40">
                  Tap once to start talking · tap again to send
                </p>
              )}
              {sttError && (
                <p className="text-sm font-medium text-amber">{sttError} You can type instead below.</p>
              )}
            </div>

            {/* Typed fallback (no speech recognition / mic blocked) */}
            {showTyping && (
              <div className="mt-4 w-full max-w-md">
                <textarea
                  value={typedDraft}
                  onChange={(e) => setTypedDraft(e.target.value)}
                  autoFocus
                  rows={2}
                  placeholder="e.g. I need help / I need water"
                  className="w-full rounded-2xl border border-teal/30 bg-white px-4 py-3 text-lg text-navy shadow-soft focus:outline-none focus:ring-2 focus:ring-teal/40"
                />
                <button
                  onClick={sendTyped}
                  className="mt-3 w-full rounded-2xl bg-teal py-4 text-lg font-bold text-white shadow-soft hover:bg-[#2c9c97]"
                >
                  Send to staff
                </button>
              </div>
            )}
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
