"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPatientSession, clearPatientSession } from "@/lib/session";
import { getStore } from "@/lib/store";
import { enqueueRequest, ensureAutoFlush } from "@/lib/supabase/outbox";
import { getRequestStatus } from "@/lib/supabase/requests";
import { openLiveBroadcaster } from "@/lib/supabase/liveChannel";
import { classifyRequest } from "@/lib/aiClassifier";
import { aiAsk, aiTriage } from "@/lib/ai/client";
import { buildPatientMemory } from "@/lib/ai/memory";
import SendConfirmation from "@/components/SendConfirmation";
import { primeTTS, speak } from "@/lib/tts";
import { useMounted, useStoreVersion } from "@/lib/useRehub";
import type { UrgencyLevel } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SR = any;

type AppView = "home" | "settings";

// Severity ranking so the live stream always surfaces the safer of two reads.
const URGENCY_RANK: Record<UrgencyLevel, number> = {
  Critical: 5, High: 4, Medium: 3, Low: 2, Informational: 1,
};
function mostSevere(a: UrgencyLevel | null, b: UrgencyLevel | null): UrgencyLevel | null {
  if (!a) return b;
  if (!b) return a;
  return URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b;
}

export default function PatientPage() {
  const mounted = useMounted();
  const router = useRouter();
  useStoreVersion();

  const [view, setView] = useState<AppView>("home");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  // Request flow: idle → sent (waiting for staff) → ack (acknowledged).
  // idle → confirm (send animation) → idle · ack (nurse responded) · error (retrying)
  const [flow, setFlow] = useState<"idle" | "confirm" | "ack" | "error">("idle");
  const [ackBy, setAckBy] = useState<string | null>(null);
  // Typed fallback for browsers without speech recognition (e.g. some iOS).
  const [showTyping, setShowTyping] = useState(false);
  const [typedDraft, setTypedDraft] = useState("");
  const [sttError, setSttError] = useState("");
  // AI ask assistant — patient can ask questions without notifying nurses.
  const [askMode, setAskMode] = useState(false);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  // Pulses true briefly each time new speech arrives → drives the live animation.
  const [voiceActive, setVoiceActive] = useState(false);
  // Voice-first accessibility: spoken welcome before any reading is required.
  const [greeted, setGreeted] = useState(false);
  const idleHelpRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const transcriptRef = useRef("");
  const askModeRef = useRef(false); // ref so stopListening() can read it synchronously
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  // Instant acknowledgement: watch the shared store directly (fires the moment
  // a nurse taps acknowledge — no network round-trip). ackedRef makes it fire once.
  const ackUnsubRef = useRef<null | (() => void)>(null);
  const ackedRef = useRef(false);
  const ackDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRef = useRef<{ send: (p: import("@/lib/supabase/liveChannel").LiveSpeakingPayload) => void; close: () => void } | null>(null);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live AI analysis: debounced Hubi triage on the partial transcript mid-speech.
  const liveAiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveAiLastText = useRef("");
  const liveAiUrgency = useRef<UrgencyLevel | null>(null);

  useEffect(() => { ensureAutoFlush(); }, []);
  // `stopEverything` is a hoisted function declaration defined below (line
  // ~103) — safe to reference here via JS hoisting, re-created fresh each
  // render like the rest of this component's helpers. Deps are intentionally
  // empty: this must run its cleanup exactly once, on unmount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- hoists safely, see comment above
    return () => stopEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above; intentionally run-once
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

  function stopAckWatch() {
    if (ackUnsubRef.current) { ackUnsubRef.current(); ackUnsubRef.current = null; }
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function stopEverything() {
    if (recRef.current) { try { recRef.current.stop(); } catch {} recRef.current = null; }
    stopPolling();
    stopAckWatch();
    closeLive(false);
    if (voiceTimerRef.current) { clearTimeout(voiceTimerRef.current); voiceTimerRef.current = null; }
    if (liveAiTimerRef.current) { clearTimeout(liveAiTimerRef.current); liveAiTimerRef.current = null; }
    if (idleHelpRef.current) { clearTimeout(idleHelpRef.current); idleHelpRef.current = null; }
    if (ackDismissRef.current) { clearTimeout(ackDismissRef.current); ackDismissRef.current = null; }
  }

  function pulseVoice() {
    setVoiceActive(true);
    if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
    voiceTimerRef.current = setTimeout(() => setVoiceActive(false), 350);
  }

  function broadcastLive(text: string, speaking: boolean) {
    if (!liveRef.current) return;
    // Merge the instant deterministic read with Hubi's live AI read (whichever
    // is more severe wins) so the nurse always sees the safest urgency.
    const deterministic = text.trim() ? classifyRequest(text).urgencyLevel ?? null : null;
    const urgency = mostSevere(deterministic, liveAiUrgency.current);
    liveRef.current.send({
      roomId,
      roomNumber: session!.roomNumber,
      residentName: session!.patientName,
      transcript: text,
      speaking,
      urgencyLevel: urgency,
      // eslint-disable-next-line react-hooks/purity -- broadcastLive only runs from speech-recognition event handlers, never during render
      ts: Date.now(),
    });
  }

  /**
   * Live AI analysis — debounced Hubi triage on the partial transcript.
   * Runs ~1.1s after the patient pauses mid-sentence (not on every word), so
   * the nurse sees an AI-refined urgency in real time while keeping credits low.
   */
  function scheduleLiveAnalysis(text: string) {
    const t = text.trim();
    if (liveAiTimerRef.current) clearTimeout(liveAiTimerRef.current);
    if (t.length < 10) return; // too little signal to spend a call on
    liveAiTimerRef.current = setTimeout(async () => {
      if (t === liveAiLastText.current) return; // already analyzed this text
      liveAiLastText.current = t;
      const preset = classifyRequest(t).urgencyLevel ?? "Low";
      const ai = await aiTriage(t, preset);
      // Bail if recording ended or nothing came back; never downgrade silently.
      if (!ai || !recRef.current || !liveRef.current) return;
      liveAiUrgency.current = ai.urgencyLevel;
      broadcastLive(transcriptRef.current, true); // push refined urgency mid-speech
    }, 1100);
  }

  function closeLive(sendStop: boolean) {
    if (!liveRef.current) return;
    if (sendStop) broadcastLive(transcriptRef.current, false);
    liveRef.current.close();
    liveRef.current = null;
  }

  /**
   * Fire the acknowledged state exactly once, from whichever path sees it first
   * (instant local store watcher OR cloud poll). Shows + SPEAKS the confirmation.
   */
  function fireAck(name: string | null) {
    if (ackedRef.current) return;
    ackedRef.current = true;
    stopPolling();
    stopAckWatch();
    setAckBy(name);
    setFlow("ack");
    const who = session!.patientName.split(" ")[0] || "there";
    // Natural AI voice (ElevenLabs) with Web Speech fallback
    void speak(
      name
        ? `Good news, ${who}. ${name} has your message and is on the way to help you. Hang tight — you're in good hands.`
        : `Good news, ${who}. Your care team has your message and is on the way to help you. Hang tight — you're in good hands.`,
    );
    // Auto-return to the ready screen — the patient never has to press anything.
    if (ackDismissRef.current) clearTimeout(ackDismissRef.current);
    ackDismissRef.current = setTimeout(() => resetFlow(), 7000);
  }

  function isAckStatus(status?: string) {
    return status === "Acknowledged" || status === "In Progress" || status === "Resolved";
  }

  /**
   * INSTANT acknowledgement on the same device: subscribe to the shared store and
   * react the moment the nurse acts — no polling delay. (Demo + single-device.)
   */
  function watchLocalAck(localId: string) {
    stopAckWatch();
    const check = () => {
      const r = store.getWorkspace(facilityId).requests.find((x) => x.id === localId);
      if (r && isAckStatus(r.status)) fireAck((r.acknowledgedBy ?? "").trim() || null);
    };
    check();
    ackUnsubRef.current = store.subscribe(check);
  }

  /**
   * Cross-device fallback: poll the cloud for this request's status. Fast cadence
   * so a nurse on another device still confirms within ~1 second.
   */
  function startAckPolling(messageId: string) {
    stopPolling();
    // eslint-disable-next-line react-hooks/purity -- startAckPolling only runs from sendRequest (a click/submit handler), never during render
    pollStartRef.current = Date.now();
    const check = async () => {
      const info = await getRequestStatus(messageId);
      if (!info) {
        if (Date.now() - pollStartRef.current > 180_000) stopPolling();
        return;
      }
      if (isAckStatus(info.status)) fireAck((info.acknowledgedBy ?? "").trim() || null);
    };
    void check();
    pollRef.current = setInterval(check, 1000);
  }

  function resetFlow() {
    stopPolling();
    stopAckWatch();
    if (ackDismissRef.current) { clearTimeout(ackDismissRef.current); ackDismissRef.current = null; }
    ackedRef.current = false;
    setFlow("idle");
    setAckBy(null);
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

    // Fresh utterance: clear any prior live AI read.
    liveAiUrgency.current = null;
    liveAiLastText.current = "";

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
      if (!askModeRef.current) {
        broadcastLive(t, true);
        scheduleLiveAnalysis(t); // Hubi refines urgency mid-sentence (debounced)
      }
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

  /** First tap on the welcome overlay: unlock audio + speak spoken guidance. */
  function beginVoiceGuide() {
    primeTTS();
    setGreeted(true);
    const who = session!.patientName.split(" ")[0] || "there";
    const room = session!.roomNumber ? ` You are in Room ${session!.roomNumber}.` : "";
    void speak(
      `Hello ${who}, I'm Hubi, your care assistant.${room} You don't need to read or type anything. ` +
      `Whenever you need help, tap the large green circle and just tell me what you need — like "I need water" or "I need my nurse."`,
    );
    // Gentle, one-time idle reminder if they don't act.
    if (idleHelpRef.current) clearTimeout(idleHelpRef.current);
    idleHelpRef.current = setTimeout(() => {
      if (flow === "idle" && !recording) {
        void speak("Whenever you're ready, tap the large green circle and tell me what you need.");
      }
    }, 22000);
  }

  /** Patient can re-hear the guidance anytime. */
  function replayGuide() {
    primeTTS();
    void speak("To reach your care team, tap the large green circle and tell me what you need. I'm always here to help.");
  }

  function clearIdleHelp() {
    if (idleHelpRef.current) { clearTimeout(idleHelpRef.current); idleHelpRef.current = null; }
  }

  function toggleTalk() {
    if (flow !== "idle") return;
    clearIdleHelp();
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
    setAckBy(null);
    setTranscript("");
    transcriptRef.current = "";
    ackedRef.current = false;

    let req;
    try {
      req = store.submitRequest({ facilityId, roomId, source, text: text || undefined });
    } catch {
      // Never pretend it sent — show the retry state and speak honestly.
      setFlow("error");
      void speak("I'm having trouble sending your request. I'll keep trying automatically.");
      return;
    }

    // Instant same-device acknowledgement (no network wait).
    watchLocalAck(req.id);
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

    // Single, continuous confirmation animation + spoken reassurance.
    setFlow("confirm");
    void speak("Your message has been sent. Your care team has it now.");
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

  function handleLeave() {
    stopEverything();
    // Free the room so it shows Available again and can be re-joined.
    store.vacateRoom(facilityId, roomId);
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
      {/* Voice-first welcome — one tap unlocks spoken guidance (no reading needed). */}
      {!greeted && (
        <button
          onClick={beginVoiceGuide}
          aria-label="Tap to begin and hear Hubi"
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 px-8 text-center"
          style={{ background: "#F5F1E8" }}
        >
          <span className="flex h-32 w-32 items-center justify-center rounded-full bg-teal/15">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2c9c97" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
            </svg>
          </span>
          <div>
            <p className="text-4xl font-extrabold tracking-tight text-navy">Tap anywhere<br />to begin</p>
            <p className="mt-4 text-xl font-medium text-slate/60">Hubi will talk you through everything.</p>
          </div>
          <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-teal px-7 py-4 text-xl font-bold text-white shadow-[0_12px_40px_rgba(56,178,172,0.4)]">
            Start
          </span>
        </button>
      )}

      {/* Top bar */}
      <header className="z-10 flex items-center justify-between px-5 pt-6">
        <div>
          <p className="text-sm font-medium text-slate/50">Room {session.roomNumber}</p>
          <p className="text-lg font-bold text-navy">Hello, {firstName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={replayGuide} aria-label="Hear help again"
            className="flex h-11 items-center gap-2 rounded-full bg-white/70 px-4 text-slate shadow-soft hover:bg-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
            </svg>
            <span className="text-sm font-semibold">Hear help</span>
          </button>
          <button onClick={() => setView("settings")} aria-label="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-slate shadow-soft hover:bg-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="z-10 flex flex-1 flex-col items-center justify-center px-6">
        {flow === "confirm" || flow === "error" ? (
          // Single, continuous send confirmation (or retry state). Auto-returns
          // to the Talk screen — no buttons, no Done.
          <SendConfirmation
            failed={flow === "error"}
            onComplete={() => { if (!ackedRef.current) setFlow("idle"); }}
          />
        ) : flow === "ack" ? (
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
