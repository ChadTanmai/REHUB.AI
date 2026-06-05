"use client";

/**
 * The voice listening bubble.
 *
 * Purely presentational: the parent (ResidentRequestPanel) owns the speech and
 * microphone-amplitude logic and passes in `state` + `scale`. The bubble grows
 * and shrinks with live voice volume (scale 1.0 → 1.18) for a calm, breathing,
 * "listening" feel. No glow, no gradient, no chatbot styling.
 */

export type BubbleState =
  | "idle"
  | "listening"
  | "processing"
  | "confirming"
  | "sent"
  | "unsupported";

const LABEL: Record<BubbleState, string> = {
  idle: "Tap to speak",
  listening: "Listening…",
  processing: "Understanding your request…",
  confirming: "Please confirm your request",
  sent: "Your request has been sent to the care team.",
  unsupported: "Voice input is unavailable. You can type your request below.",
};

export default function VoiceRequestBubble({
  state,
  scale = 1,
  onTap,
}: {
  state: BubbleState;
  scale?: number;
  onTap: () => void;
}) {
  const tappable = state === "idle" || state === "listening";

  // Solid teal while active; a soft mint ring at rest. Flat, clinical.
  const circleColor =
    state === "sent"
      ? "bg-success"
      : state === "unsupported"
        ? "bg-gray-muted"
        : "bg-teal";

  return (
    <div className="flex flex-col items-center gap-5">
      <button
        type="button"
        onClick={tappable ? onTap : undefined}
        disabled={!tappable}
        aria-label={LABEL[state]}
        className={`relative flex h-44 w-44 items-center justify-center rounded-full text-white shadow-panel transition-transform duration-150 ease-out sm:h-52 sm:w-52 ${circleColor} ${
          tappable ? "cursor-pointer" : "cursor-default"
        } ${state === "idle" ? "rehub-breathe" : ""}`}
        style={{
          transform: `scale(${state === "listening" ? scale : 1})`,
          // Soft mint halo ring — a flat outline, not a neon glow.
          boxShadow:
            state === "listening"
              ? "0 0 0 12px rgba(47,158,158,0.12), 0 0 0 24px rgba(47,158,158,0.06)"
              : undefined,
        }}
      >
        <MicGlyph muted={state === "unsupported"} />
      </button>

      <p
        className={`max-w-xs text-center text-lg font-medium ${
          state === "unsupported" ? "text-slate/80" : "text-navy"
        }`}
      >
        {LABEL[state]}
      </p>
    </div>
  );
}

function MicGlyph({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M9 9v3a3 3 0 004.5 2.6M15 11.5V6a3 3 0 00-5.8-1.1M5 11a7 7 0 0010.7 6M19 11a7 7 0 01-.5 2.6M12 19v3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M5 11a7 7 0 0014 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
