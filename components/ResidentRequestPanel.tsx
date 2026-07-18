"use client";

import { useEffect, useRef, useState } from "react";
import type { AIClassification, Request, RequestSource, RequestType } from "@/lib/types";
import { classifyRequest } from "@/lib/aiClassifier";
import { getStore } from "@/lib/store";
import { useWorkspace } from "@/lib/useRehub";
import { primeTTS, speak } from "@/lib/tts";
import {
  amplitudeToScale,
  isSpeechRecognitionSupported,
  startAmplitudeMeter,
  startSpeechRecognition,
  type AmplitudeMeter,
  type SpeechSession,
} from "@/lib/voiceUtils";
import VoiceRequestBubble, { type BubbleState } from "./VoiceRequestBubble";
import VoiceTranscriptPanel from "./VoiceTranscriptPanel";
import AIUrgencyReview from "./AIUrgencyReview";
import RequestConfirmation from "./RequestConfirmation";
import RequestButton, { type ButtonVariant } from "./RequestButton";
import {
  NurseIcon, WaterIcon, PainIcon, BathroomIcon, FoodIcon, MedicationIcon,
  MobilityIcon, BlanketIcon, PositionChangeIcon, TooColdIcon, TooHotIcon,
  FamilyIcon, TechnicalHelpIcon, TelevisionIcon, PhoneIcon, CustomIcon,
} from "./RequestIcons";

type Mode = "choose" | "typing" | "reviewing" | "sent";
type CommMode = "voice" | "buttons" | "both";

interface QuickOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  variant: ButtonVariant;
  /** When set, this single-press option submits immediately as that type. */
  fixedType?: RequestType;
}

/**
 * 15 quick-select options. The 7 with a fixedType map onto the deterministic
 * classifier's known RequestType enum; the rest are free-label comfort/
 * operational requests that flow through as plain text (same path a typed or
 * voice request takes) — the classifier still assigns a sensible type and
 * priority from the words, it's just not forced.
 */
const QUICK_OPTIONS: QuickOption[] = [
  { key: "help", label: "Need Nurse", icon: <NurseIcon />, variant: "teal", fixedType: "Help" },
  { key: "pain", label: "Pain", icon: <PainIcon />, variant: "coral", fixedType: "Pain" },
  { key: "bathroom", label: "Bathroom", icon: <BathroomIcon />, variant: "amber", fixedType: "Bathroom" },
  { key: "water", label: "Water", icon: <WaterIcon />, variant: "mint", fixedType: "Water" },
  { key: "food", label: "Food", icon: <FoodIcon />, variant: "mint", fixedType: "Food" },
  { key: "mobility", label: "Mobility Help", icon: <MobilityIcon />, variant: "teal", fixedType: "Mobility" },
  { key: "medication", label: "Medication Question", icon: <MedicationIcon />, variant: "amber", fixedType: "Medication Question" },
  { key: "blanket", label: "Blanket", icon: <BlanketIcon />, variant: "navy" },
  { key: "position", label: "Position Change", icon: <PositionChangeIcon />, variant: "navy" },
  { key: "cold", label: "Too Cold", icon: <TooColdIcon />, variant: "navy" },
  { key: "hot", label: "Too Hot", icon: <TooHotIcon />, variant: "navy" },
  { key: "family", label: "Family Request", icon: <FamilyIcon />, variant: "navy" },
  { key: "technical", label: "Technical Help", icon: <TechnicalHelpIcon />, variant: "navy" },
  { key: "tv", label: "Television", icon: <TelevisionIcon />, variant: "navy" },
  { key: "phone", label: "Phone Assistance", icon: <PhoneIcon />, variant: "navy" },
];

const COMM_MODE_LABEL: Record<CommMode, string> = {
  voice: "Voice only",
  buttons: "Buttons only",
  both: "Voice + Buttons",
};

function commModeKey(roomId: string) {
  return `rehub:comm-mode:${roomId}`;
}

export default function ResidentRequestPanel({
  facilityId,
  roomId,
  onSubmitted,
}: {
  facilityId: string;
  roomId: string;
  onSubmitted?: (request: Request) => void;
}) {
  const store = getStore();
  const workspace = useWorkspace(facilityId);

  const [mode, setMode] = useState<Mode>("choose");
  const [bubbleState, setBubbleState] = useState<BubbleState>("idle");
  const [scale, setScale] = useState(1);
  const [transcript, setTranscript] = useState("");
  const [editable, setEditable] = useState(false);
  const [source, setSource] = useState<RequestSource>("Voice");
  const [classification, setClassification] = useState<AIClassification | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [commMode, setCommMode] = useState<CommMode>("both");

  const meterRef = useRef<AmplitudeMeter | null>(null);
  const speechRef = useRef<SpeechSession | null>(null);
  // Computed once on the client (this panel only renders after mount).
  const [speechSupported] = useState(() => isSpeechRecognitionSupported());

  // Load the saved input-mode preference for this room device. localStorage
  // is browser-only, so this genuinely needs to run post-mount in an effect.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(commModeKey(roomId));
      if (saved === "voice" || saved === "buttons" || saved === "both") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
        setCommMode(saved);
      }
    } catch { /* ignore */ }
  }, [roomId]);

  function changeCommMode(next: CommMode) {
    setCommMode(next);
    try { localStorage.setItem(commModeKey(roomId), next); } catch { /* ignore */ }
  }

  // Always release the mic on unmount.
  useEffect(() => {
    return () => {
      meterRef.current?.stop();
      speechRef.current?.stop();
    };
  }, []);

  function stopListening() {
    meterRef.current?.stop();
    meterRef.current = null;
    speechRef.current?.stop();
    speechRef.current = null;
    setScale(1);
  }

  async function handleBubbleTap() {
    primeTTS();
    if (bubbleState === "listening") {
      // Tap again to stop early.
      stopListening();
      return;
    }
    if (!speechSupported) {
      setBubbleState("unsupported");
      setMode("typing");
      setSource("Typed");
      return;
    }

    setBubbleState("listening");
    setSource("Voice");

    meterRef.current = await startAmplitudeMeter((level) =>
      setScale(amplitudeToScale(level)),
    );

    speechRef.current = startSpeechRecognition({
      onInterim: (t) => setTranscript(t),
      onFinal: (t) => {
        setTranscript(t);
        review(t, "Voice");
      },
      onError: () => {
        stopListening();
        setBubbleState("unsupported");
        setMode("typing");
        setSource("Typed");
      },
      onEnd: () => {
        meterRef.current?.stop();
        meterRef.current = null;
        setScale(1);
      },
    });

    // If recognition couldn't start at all, fall back to typing.
    if (!speechRef.current) {
      stopListening();
      setBubbleState("unsupported");
      setMode("typing");
      setSource("Typed");
    }
  }

  function review(text: string, src: RequestSource) {
    if (!text.trim()) {
      setBubbleState("idle");
      return;
    }
    setSelected(new Set());
    setBubbleState("processing");
    setSource(src);
    // Brief, honest "understanding" beat before showing the result.
    setTimeout(() => {
      const result = classifyRequest(text, {
        recentUnresolvedCount: countRecent(),
      });
      setClassification(result);
      setBubbleState("confirming");
      setEditable(false);
      setMode("reviewing");
    }, 450);
  }

  function countRecent() {
    return workspace.requests.filter(
      (r) =>
        r.roomId === roomId &&
        r.status !== "Resolved" &&
        Date.now() - new Date(r.createdAt).getTime() <= 30 * 60000,
    ).length;
  }

  function handleTranscriptChange(v: string) {
    setTranscript(v);
    if (editable) {
      setClassification(
        classifyRequest(v, { recentUnresolvedCount: countRecent() }),
      );
    }
  }

  function submit(opts: {
    source: RequestSource;
    text?: string;
    fixedType?: RequestType;
  }) {
    const req = store.submitRequest({
      facilityId,
      roomId,
      source: opts.source,
      text: opts.text,
      fixedType: opts.fixedType,
    });
    setSentId(req.id);
    setBubbleState("sent");
    setMode("sent");
    onSubmitted?.(req);
  }

  /** Tap a quick-select tile: toggles it in/out of the pending selection and
   *  speaks the label aloud so the resident hears what they just chose.
   *  Nothing sends until Send is pressed — this is what lets several tiles
   *  be combined into one request. */
  function toggleOption(opt: QuickOption) {
    primeTTS();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(opt.key)) {
        next.delete(opt.key);
      } else {
        next.add(opt.key);
        void speak(opt.label);
      }
      return next;
    });
  }

  function sendSelected() {
    const picked = QUICK_OPTIONS.filter((o) => selected.has(o.key));
    if (!picked.length) return;
    if (picked.length === 1 && picked[0].fixedType) {
      // A single well-known option (Water, Pain, Bathroom, ...) — submit with
      // its exact type rather than routing through free-text classification.
      submit({ source: "Button", fixedType: picked[0].fixedType });
    } else {
      // Multiple selections, or a free-label option with no fixed type —
      // combine into one comma-separated request; the classifier still
      // assigns a type/priority from the words.
      submit({ source: "Button", text: picked.map((o) => o.label).join(", ") });
    }
    setSelected(new Set());
  }

  function startCustom() {
    setSource("Typed");
    setTranscript("");
    setEditable(true);
    setSelected(new Set());
    setMode("typing");
  }

  function resetAll() {
    stopListening();
    setMode("choose");
    setBubbleState("idle");
    setTranscript("");
    setClassification(null);
    setSentId(null);
    setEditable(false);
    setSelected(new Set());
  }

  // --- render: sent confirmation (reads live request for status updates) ---
  if (mode === "sent" && sentId) {
    const live = workspace.requests.find((r) => r.id === sentId);
    if (live) {
      return <RequestConfirmation request={live} onNewRequest={resetAll} />;
    }
  }

  const showVoice = mode === "choose" && commMode !== "buttons";
  const showButtons = mode === "choose" && commMode !== "voice";

  return (
    <div className="space-y-6 pb-4">
      {/* Input mode toggle */}
      {mode === "choose" && (
        <div className="flex justify-center gap-1 rounded-full border border-gray-muted bg-white p-1">
          {(["both", "voice", "buttons"] as CommMode[]).map((cm) => (
            <button
              key={cm}
              type="button"
              onClick={() => changeCommMode(cm)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                commMode === cm ? "bg-navy text-white" : "text-slate hover:bg-offwhite"
              }`}
            >
              {COMM_MODE_LABEL[cm]}
            </button>
          ))}
        </div>
      )}

      {/* Voice bubble */}
      {(mode !== "choose" || showVoice) && (
        <div className="rounded-2xl border border-gray-muted bg-white px-6 py-8">
          <VoiceRequestBubble
            state={bubbleState}
            scale={scale}
            onTap={handleBubbleTap}
          />
        </div>
      )}

      {/* Transcript + review for voice/typed flows */}
      {(mode === "reviewing" || mode === "typing") && (
        <div className="space-y-4">
          <VoiceTranscriptPanel
            value={transcript}
            editable={editable || mode === "typing"}
            onChange={handleTranscriptChange}
          />

          {mode === "typing" && (
            <button
              type="button"
              onClick={() => review(transcript, source)}
              disabled={!transcript.trim()}
              className="min-h-[56px] w-full rounded-xl bg-teal px-5 text-lg font-semibold text-white shadow-soft transition-colors hover:bg-[#2a8d8d] disabled:opacity-50"
            >
              Review request
            </button>
          )}

          {mode === "reviewing" && classification && (
            <AIUrgencyReview
              classification={classification}
              onConfirm={() =>
                submit({ source, text: transcript })
              }
              onEdit={() => {
                setEditable(true);
                setMode("typing");
              }}
              onCancel={resetAll}
            />
          )}
        </div>
      )}

      {/* Quick-select buttons */}
      {showButtons && (
        <div>
          <p className="mb-3 text-sm font-medium text-slate/70">
            {selected.size > 0
              ? "Tap all that apply, then send"
              : "Or tap what you need"}
          </p>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {QUICK_OPTIONS.map((opt) => (
              <RequestButton
                key={opt.key}
                label={opt.label}
                variant={opt.variant}
                icon={opt.icon}
                selected={selected.has(opt.key)}
                onClick={() => toggleOption(opt)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={startCustom}
            className="mt-3 min-h-[52px] w-full rounded-xl border-2 border-navy bg-white px-5 text-base font-semibold text-navy transition-colors hover:bg-navy/5"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <CustomIcon className="h-5 w-5" />
              Type something else
            </span>
          </button>
        </div>
      )}

      {/* Floating send button — appears once at least one quick option is selected */}
      {showButtons && selected.size > 0 && (
        <div className="rehub-rise fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:px-0 sm:pb-0">
          <button
            type="button"
            onClick={sendSelected}
            className="flex min-h-[60px] w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-teal px-6 text-lg font-bold text-white shadow-panel transition-transform hover:scale-[1.02] hover:bg-[#2a8d8d] sm:w-auto"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
            Send request{selected.size > 1 ? ` (${selected.size})` : ""}
          </button>
        </div>
      )}
    </div>
  );
}
