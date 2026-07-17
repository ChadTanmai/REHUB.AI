"use client";

/**
 * HubiWidget — the floating, always-present face of Hubi.
 *
 * A bottom-right floating button (subtle breathing animation) that expands into
 * a premium, physics-based assistant panel. Works in two modes:
 *
 *   • Public (logged-out, on the marketing site) — a live PREVIEW: visitors can
 *     chat or talk to Hubi and learn what ReHub does, before signing in.
 *   • In-app (logged-in) — a global helper available on every page, aware of
 *     which page the user is on (context awareness).
 *
 * Every answer comes from the controlled `guide` knowledge base (server) so
 * there are no hallucinations. If Hubi isn't configured (no API key) or the
 * network fails, it falls back to a small built-in ReHub knowledge base, so the
 * preview always works and never goes off-topic.
 *
 * Voice: tap the mic for speech-to-text; Hubi speaks every reply back via the
 * shared TTS layer (ElevenLabs when configured, Web Speech otherwise).
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { aiGuide } from "@/lib/ai/client";
import { primeTTS, speak } from "@/lib/tts";
import { HUBI_NAME, HUBI_FULL } from "@/lib/ai/hubi";
import { useMounted } from "@/lib/useRehub";

type Msg = { role: "hubi" | "user"; text: string };

const SUGGESTIONS = [
  "What does ReHub do?",
  "How does patient communication work?",
  "What is the command center?",
  "How does AI prioritization work?",
  "How do patients join rooms?",
];

const INTRO =
  "Hi, I'm Hubi — ReHub's AI care coordinator. I help patients, nurses, therapists, and " +
  "administrators communicate faster and more clearly. Ask me anything about ReHub, or tap the mic and talk to me.";

// Local fallback knowledge base — used only when the AI service is unavailable,
// so the preview still answers (and only ever about ReHub).
const LOCAL_KB: { keys: string[]; answer: string }[] = [
  { keys: ["what", "do", "rehub", "about", "platform"], answer:
    "ReHub is an AI-powered communication platform for rehab and senior-care facilities. Patients request help by voice, button, or text; I summarize and prioritize each request and route it to the right staff in real time." },
  { keys: ["communication", "patient", "request", "work"], answer:
    "Each room has a tablet. A patient taps a big button, speaks, or types — then confirms before sending. I instantly summarize the request, score its urgency, and surface it to the care team." },
  { keys: ["command", "center", "staff", "nurse"], answer:
    "The command center is the staff workspace. Every request shows my summary, priority, confidence, suggested action, and a suggested reply. Critical requests auto-surface and alert the team; staff acknowledge and resolve with one tap." },
  { keys: ["priorit", "urgency", "ai", "critical", "safety"], answer:
    "A deterministic safety engine runs first — hard rules flag critical phrases like 'I can't breathe' as Critical instantly, with no AI uncertainty. Then I refine the urgency and can only raise it, never silently lower it. Rules always win." },
  { keys: ["join", "room", "pair", "code", "setup"], answer:
    "Staff share a short facility code or link, and the room tablet pairs in seconds — no app to install. A whole facility is usually set up in under ten minutes." },
  { keys: ["voice", "speak", "talk", "listen", "microphone"], answer:
    "Patients can simply talk to me — I listen (speech-to-text) and reply out loud (text-to-speech). It's hands-free and friendly, designed for residents who find typing hard." },
  { keys: ["analytic", "report", "data", "search"], answer:
    "I power natural-language analytics and search — ask things like 'which rooms had the most requests today?' — plus end-of-shift handoff summaries for the charge nurse." },
  { keys: ["privacy", "secure", "hipaa", "data", "safe"], answer:
    "Data is scoped per facility with row-level security and an immutable audit trail, on a documented path to HIPAA-ready deployment. Devices never talk directly — everything routes through the ReHub backend." },
];

function localAnswer(q: string): string {
  const text = q.toLowerCase();
  let best: { score: number; answer: string } | null = null;
  for (const e of LOCAL_KB) {
    const score = e.keys.reduce((n, k) => (text.includes(k) ? n + 1 : n), 0);
    if (score > 0 && (!best || score > best.score)) best = { score, answer: e.answer };
  }
  return best?.answer ??
    "I'm Hubi, ReHub's AI care coordinator. I can explain how patients send requests, how the command center works, how AI prioritization keeps patients safe, and how to set up a facility. What would you like to know?";
}

export default function HubiWidget({
  pageContext = "",
  signedIn = false,
}: {
  pageContext?: string;
  signedIn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const [messages, setMessages] = useState<Msg[]>([{ role: "hubi", text: INTRO }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false); // speak replies aloud
  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || thinking) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setThinking(true);

    const res = await aiGuide(q, { pageContext, signedIn });
    const answer = res?.answer?.trim() || localAnswer(q);
    setThinking(false);
    setMessages((m) => [...m, { role: "hubi", text: answer }]);
    if (voiceOn) void speak(answer);
  }

  function toggleMic() {
    if (listening) {
      try { recRef.current?.stop(); } catch { /* ignore */ }
      setListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMessages((m) => [...m, { role: "hubi", text: "Your browser doesn't support voice input here — but you can type to me and I'll still reply out loud." }]);
      return;
    }
    primeTTS();        // unlock audio inside the user gesture so replies autoplay
    setVoiceOn(true);  // talking implies they want to hear Hubi
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => {
      finalText = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setInput(finalText);
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) void ask(finalText);
    };
    rec.onerror = () => setListening(false);
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  const spring = { type: "spring" as const, stiffness: 320, damping: 32, mass: 0.9 };

  const ui = (
    <>
      {/* Floating launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="hubi-fab"
            onClick={() => { primeTTS(); setOpen(true); }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={spring}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            aria-label="Open Hubi assistant"
            className="fixed bottom-5 right-5 z-[90] flex items-center gap-2.5 rounded-full bg-navy py-3 pl-3 pr-4 text-white shadow-[0_18px_50px_-12px_rgba(16,42,67,0.65)]"
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/20" style={{ animationDuration: "2.8s" }} />
              <span className="relative text-base font-black">H</span>
            </span>
            <span className="text-sm font-bold tracking-tight">Ask Hubi</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Assistant panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="hubi-panel"
            initial={{ opacity: 0, y: 40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.92 }}
            transition={spring}
            className="fixed bottom-5 right-5 z-[90] flex h-[min(620px,82vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-white/40 bg-white shadow-[0_30px_80px_-20px_rgba(15,34,51,0.55)]"
          >
            {/* Header */}
            <div className="relative overflow-hidden bg-navy px-5 py-4 text-white">
              <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-teal/30 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-black">H</span>
                <div className="flex-1">
                  <p className="text-sm font-bold leading-tight">{HUBI_NAME}</p>
                  <p className="text-[11px] text-white/60">{HUBI_FULL}</p>
                </div>
                <button
                  onClick={() => setVoiceOn((v) => !v)}
                  aria-label={voiceOn ? "Mute Hubi" : "Let Hubi speak"}
                  title={voiceOn ? "Voice replies on" : "Voice replies off"}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${voiceOn ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/15"}`}
                >
                  {voiceOn ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
                <button onClick={() => setOpen(false)} aria-label="Close Hubi"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/15 hover:text-white">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-offwhite px-4 py-4">
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-navy text-white"
                      : "rounded-bl-md border border-gray-muted bg-white text-navy"
                  }`}>
                    {m.text}
                  </div>
                </motion.div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl rounded-bl-md border border-gray-muted bg-white px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal/60" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestion chips — only before the first user turn */}
              {messages.length === 1 && !thinking && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)}
                      className="rounded-full border border-teal/25 bg-white px-3 py-1.5 text-xs font-medium text-teal transition-colors hover:bg-teal/8">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-gray-muted bg-white p-3">
              <div className="flex items-end gap-2">
                <button onClick={toggleMic} aria-label="Talk to Hubi"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    listening ? "border-coral/40 bg-coral/10 text-coral" : "border-gray-muted text-slate hover:border-teal/40 hover:bg-teal/5 hover:text-teal"
                  }`}>
                  {listening ? (
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-coral" />
                    </span>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
                  rows={1}
                  placeholder={listening ? "Listening…" : "Ask Hubi about ReHub…"}
                  className="max-h-24 flex-1 resize-none rounded-xl border border-gray-muted bg-offwhite px-3.5 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/40"
                />
                <button onClick={() => ask(input)} disabled={!input.trim() || thinking} aria-label="Send"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white transition-transform hover:scale-105 disabled:opacity-40">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-slate/40">
                {signedIn ? "Hubi · context-aware assistant" : "Preview · Hubi answers only about ReHub"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (!mounted) return null;
  return createPortal(ui, document.body);
}
