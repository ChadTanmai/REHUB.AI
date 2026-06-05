"use client";

import { useEffect, useRef, useState } from "react";
import type { AIClassification, Request, RequestSource, RequestType } from "@/lib/types";
import { classifyRequest } from "@/lib/aiClassifier";
import { getStore } from "@/lib/store";
import { useWorkspace } from "@/lib/useRehub";
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
import RequestButton, { TYPE_LABEL, TYPE_VARIANT } from "./RequestButton";

type Mode = "choose" | "typing" | "reviewing" | "sent";

const MANUAL_TYPES: RequestType[] = [
  "Help",
  "Pain",
  "Bathroom",
  "Water",
  "Food",
  "Mobility",
  "Medication Question",
  "Custom",
];

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

  const meterRef = useRef<AmplitudeMeter | null>(null);
  const speechRef = useRef<SpeechSession | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());
  }, []);

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

  function handleManual(type: RequestType) {
    if (type === "Custom") {
      setSource("Typed");
      setTranscript("");
      setEditable(true);
      setMode("typing");
      return;
    }
    submit({ source: "Button", fixedType: type });
  }

  function resetAll() {
    stopListening();
    setMode("choose");
    setBubbleState("idle");
    setTranscript("");
    setClassification(null);
    setSentId(null);
    setEditable(false);
  }

  // --- render: sent confirmation (reads live request for status updates) ---
  if (mode === "sent" && sentId) {
    const live = workspace.requests.find((r) => r.id === sentId);
    if (live) {
      return <RequestConfirmation request={live} onNewRequest={resetAll} />;
    }
  }

  return (
    <div className="space-y-6">
      {/* Voice bubble */}
      <div className="rounded-2xl border border-gray-muted bg-white px-6 py-8">
        <VoiceRequestBubble
          state={bubbleState}
          scale={scale}
          onTap={handleBubbleTap}
        />
      </div>

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

      {/* Manual request buttons */}
      {mode === "choose" && (
        <div>
          <p className="mb-3 text-sm font-medium text-slate/70">
            Or tap what you need
          </p>
          <div className="grid grid-cols-2 gap-3">
            {MANUAL_TYPES.map((type) => (
              <div
                key={type}
                className={type === "Custom" ? "col-span-2" : ""}
              >
                <RequestButton
                  label={TYPE_LABEL[type]}
                  variant={TYPE_VARIANT[type]}
                  onClick={() => handleManual(type)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
