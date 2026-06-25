"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPatientSession, clearPatientSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { enqueueRequest, ensureAutoFlush } from "@/lib/supabase/outbox";
import { getRequestStatus } from "@/lib/supabase/requests";
import { openLiveBroadcaster } from "@/lib/supabase/liveChannel";
import { classifyRequest } from "@/lib/aiClassifier";
import { aiConverse, aiRoute, aiAsk } from "@/lib/ai/client";
import { buildPatientMemory } from "@/lib/ai/memory";
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
  // Optional AI clarifying question shown after a non-urgent request.
  const [clarify, setClarify] = useState<string | null>(null);
  const [clarifyDraft, setClarifyDraft] = useState("");
  // Smart routing: staff member the patient addressed by name.
  const [routedTo, setRoutedTo] = useState<string | null>(null);
  // AI ask assistant — patient can ask questions without notifying nurses.
  const [askMode, setAskMode] = useState(false);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  // Pulses true briefly each time new speech arrives → drives the live animation.
  const [voiceActive, setVoiceActive] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const transcriptRef = useRef("");
  const askModeRef = useRef(false); // ref so stopListening() can read it synchronously
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const liveRef = useRef<{ send: (p: import("@/lib/supabase/liveChannel").LiveSpeakingPayload) => void; close: () => void } | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { ensureAutoFlush(); }, []);
  useEffect(() => { return () => stopEverything(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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

  function pulseVoice() {
    setVoiceActive(true);
    if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
    voiceTimerRef.current = setTimeout(() => setVoiceActive(false), 350);
  }

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

  function closeLive(sendStop: boolean) {
    if (!liveRef.current) return;
    if (sendStop) broadcastLive(transcriptRef.current, false);
    liveRef.current.close();
    liveRef.current = null;
  }

  /**
   * Poll the cloud for this request's status until a nurse acknowledges (or a
   * timeout). When acknowledged, show + SPEAK the confirmation with the staff name.
   */
  function startAckPolling(messageId: string) {
    stopPolling();
    pollStartRef.current = Date.now();
    const check = async () => {
      const info = await getRequestStatus(messageId);
      if (!info) {
        if (Date.now() - pollStartRef.current > 180_000) stopPolling();
        return;
      }
      if (info.status === "Acknowledged" || info.status === "In Progress" || info.status === "Resolved") {
        stopPolling();
        const name = (info.acknowledgedBy ?? "").trim();
        setAckBy(name || null);
        setFlow("ack");
        const who = session!.patientName.split(" ")[0] || "there";
        // Natural AI voice (ElevenLabs) with Web Speech fallback
        void speak(
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
    setClarify(null);
    setClarifyDraft("");
    setRoutedTo(null);
    setAskAnswer(null);
  }

  function startListening() {
    // Unlock TTS (Web Speech + AudioContext) inside this user gesture so the
    // spoken nurse confirmation and AI answers autoplay later without another tap.
    primeTTS();
    setTranscript("");
    transcriptRef.current = "";
    setSttError("");
    setTypedDraft("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SRClass = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SRClass) {
      setRecording(true);
      setShowTyping(true);
      return;
    }

    setRecording(true);
    setShowTyping(false);

    // Only open live broadcast for staff requests, not for ask-mode questions
    if (!askModeRef.current) {
      liveRef.current = openLiveBroadcaster(facilityId);
      broadcastLive("", true);
    }

    const rec: SR = new SRClass();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = Array.from(e.results as unknown[])
        .map((r: unknown) => (r as SpeechRecognitionResult)[0].transcript)
        .join(" ");
      transcriptRef.current = t;
      setTranscript(t);
      pulseVoice();
      if (!askModeRef.current) broadcastLive(t, true);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      const err = e?.error ?? "unknown";
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

    if (askModeRef.current) {
      // Ask mode: send to AI instead of nurses
      askModeRef.current = false;
      setAskMode(false);
      void sendAsk(finalText);
    } else {
      sendRequest(finalText ? "Voice" : "Button", finalText);
    }
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
    if (recording) {
      stopListening();
    } else {
      askModeRef.current = false;
      setAskMode(false);
      startListening();
    }
  }

  function toggleAsk() {
    if (flow !== "idle") return;
    if (recording) {
      // Stop whatever is currently recording
      stopListening();
    } else {
      setAskAnswer(null);
      askModeRef.current = true;
      setAskMode(true);
      startListening();
    }
  }

  function sendRequest(source: "Button" | "Voice" | "Typed", text: string) {
    if (!room) return;
    setRoutedTo(null);
    const req = store.submitRequest({ facilityId, roomId, source, text: text || undefined });
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
    setClarify(null);
    setClarifyDraft("");
    setTranscript("");
    transcriptRef.current = "";

    // Smart routing: if patient mentioned a staff name, detect and surface it
    const therapistNames = ws.therapists.map((t) => t.name);
    if (text && therapistNames.length > 0) {
      aiRoute(text, therapistNames).then((result) => {
        if (result?.staffName) setRoutedTo(result.staffName);
      }).catch(() => {});
    }

    // Patient conversation: AI clarifying question for non-urgent requests
    if (text && (req.urgencyLevel ?? "Medium") !== "Critical") {
      aiConverse(text).then((c) => {
        if (c && !c.done && c.reply) setClarify(c.reply);
      });
    }
  }

  /** AI ask assistant — answers the patient without notifying nurses. */
  async function sendAsk(question: string) {
    if (!question.trim()) {
      setAskMode(false);
      return;
    }
    setAskLoading(true);
    setAskAnswer(null);
    const therapists = ws.therapists.map((t) => `${t.name} (${t.role})`).join(", ");
    const memory = buildPatientMemory(store, facilityId, { roomId });
    const result = await aiAsk(question, {
      patientName: session!.patientName,
      roomNumber: session!.roomNumber,
      facilityName: session!.facilityName,
      staffContext: therapists ? `Staff on duty: ${therapists}.` : "",
      patientContext: memory.context,
    });
    setAskLoading(false);
    if (result?.answer) {
      setAskAnswer(result.answer);
      void speak(result.answer);
    } else {
      setAskAnswer("I'm sorry, I wasn't able to get an answer. Please ask your nurse.");
    }
  }

  function sendClarify() {
    const detail = clarifyDraft.trim();
    setClarify(null);
    setClarifyDraft("");
    if (detail) sendRequest("Typed", detail);
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
  const glowOpacity = recording ? 0.4 : 0.25;
  const isAsk = askMode || askLoading || !!askAnswer;

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
            {routedTo && (
              <div className="flex items-center gap-2 rounded-full bg-[#1d4ed8]/10 px-4 py-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm font-semibold text-[#1d4ed8]">Directed to {routedTo}</span>
              </div>
            )}
            {clarify ? (
              <div className="mt-2 w-full max-w-md rounded-2xl border border-teal/30 bg-white/70 p-4 text-left shadow-soft">
                <p className="text-base font-medium text-navy">{clarify}</p>
                <textarea
                  value={clarifyDraft}
                  onChange={(e) => setClarifyDraft(e.target.value)}
                  rows={2}
                  placeholder="Optional — tap to add detail"
                  className="mt-2 w-full rounded-xl border border-gray-muted bg-white px-3 py-2 text-base text-navy focus:outline-none focus:ring-2 focus:ring-teal/40"
                />
                <div className="mt-2 flex gap-2">
                  <button onClick={sendClarify}
                    className="flex-1 rounded-xl bg-teal py-2.5 text-sm font-bold text-white hover:bg-[#2c9c97]">
                    Send detail
                  </button>
                  <button onClick={() => setClarify(null)}
                    className="rounded-xl border border-gray-muted px-4 py-2.5 text-sm font-semibold text-slate hover:bg-offwhite">
                    Skip
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate/40">Waiting for staff to respond…</p>
            )}
            <button onClick={resetFlow}
              className="mt-2 rounded-2xl border border-slate/20 bg-white/60 px-7 py-3 text-base font-semibold text-slate hover:bg-white">
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* AI Ask answer card */}
            {(askLoading || askAnswer) && !recording && (
              <div className="mb-6 w-full max-w-md rounded-2xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 p-4 shadow-soft">
                {askLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#7c3aed]/30 border-t-[#7c3aed]" />
                    <p className="text-sm font-medium text-[#7c3aed]">AI assistant is thinking…</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#7c3aed" stroke="none">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17h-2v-2h2zm0-4h-2V7h2z" />
                      </svg>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#7c3aed]">AI Assistant</p>
                    </div>
                    <p className="text-sm leading-relaxed text-navy">{askAnswer}</p>
                    <button onClick={() => setAskAnswer(null)}
                      className="mt-2 text-xs text-[#7c3aed]/60 hover:text-[#7c3aed]">
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            )}

            <p className="mb-10 text-center text-lg font-medium text-slate/50">
              {showTyping
                ? "Type your message to staff"
                : recording && askMode
                  ? "Ask me anything — I'm listening…"
                  : recording
                    ? "I'm listening…"
                    : isAsk
                      ? "Ask AI anything about your care"
                      : "Tap the circle to talk to staff"}
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
                className={`absolute rounded-full ${recording && !askMode ? "animate-[pulse_1.4s_ease-in-out_infinite]" : "animate-[pulse_2.6s_ease-in-out_infinite]"}`}
                style={{
                  width: 300, height: 300,
                  background: recording && askMode
                    ? "radial-gradient(circle, rgba(124,58,237,0.35) 0%, rgba(124,58,237,0) 70%)"
                    : "radial-gradient(circle, rgba(56,178,172,0.45) 0%, rgba(56,178,172,0) 70%)",
                  opacity: glowOpacity,
                }}
              />
              {/* Border ring */}
              <span
                className={`absolute rounded-full border-2 ${recording ? "animate-[ping_1.6s_ease-in-out_infinite]" : "animate-[pulse_2.6s_ease-in-out_infinite]"}`}
                style={{
                  width: 260, height: 260,
                  borderColor: recording && askMode ? "rgba(124,58,237,0.35)" : "rgba(56,178,172,0.35)",
                }}
              />
              {/* Core */}
              <span
                className="relative flex items-center justify-center rounded-full text-white shadow-[0_12px_40px_rgba(56,178,172,0.45)] transition-transform duration-200 ease-out"
                style={{
                  width: 220, height: 220,
                  background: recording && askMode
                    ? "radial-gradient(circle at 50% 40%, #9f67ff, #7c3aed)"
                    : recording
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
              {!recording && !sttError && !isAsk && (
                <p className="text-sm text-slate/40">
                  Tap once to start talking · tap again to send
                </p>
              )}
              {sttError && (
                <p className="text-sm font-medium text-amber">{sttError} You can type instead below.</p>
              )}
            </div>

            {/* AI Ask button */}
            {!recording && !showTyping && !sttError && (
              <button
                onClick={toggleAsk}
                className="mt-5 flex items-center gap-2 rounded-full border border-[#7c3aed]/25 bg-[#7c3aed]/8 px-5 py-2.5 text-sm font-semibold text-[#7c3aed] transition-colors hover:bg-[#7c3aed]/15"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" />
                  <circle cx="12" cy="17" r=".5" fill="currentColor" />
                </svg>
                {askLoading ? "Thinking…" : "Ask AI a question"}
              </button>
            )}

            {/* Typed fallback */}
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
