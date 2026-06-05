"use client";

/**
 * Shows the transcribed/typed text and lets the resident edit it before the
 * request is classified and confirmed. Voice requests are never auto-submitted.
 */

export default function VoiceTranscriptPanel({
  value,
  editable,
  onChange,
  placeholder = "Type what you need help with…",
}: {
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-muted bg-white p-4">
      <p className="mb-2 text-sm font-medium text-slate/70">We heard</p>
      {editable ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none rounded-lg border border-gray-muted bg-offwhite px-3 py-2 text-lg text-navy outline-none focus:border-teal"
        />
      ) : (
        <p className="text-lg text-navy">{value || "…"}</p>
      )}
    </div>
  );
}
