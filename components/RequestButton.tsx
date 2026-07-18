"use client";

import type { RequestType } from "@/lib/types";

export type ButtonVariant = "coral" | "teal" | "amber" | "mint" | "navy";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  coral: "bg-coral text-white hover:bg-[#c64e41] active:bg-[#b8453a]",
  teal: "bg-teal text-white hover:bg-[#2a8d8d] active:bg-[#247d7d]",
  amber: "bg-amber text-navy hover:bg-[#dca515] active:bg-[#c8950f]",
  mint: "bg-mint text-navy border border-teal/30 hover:bg-[#c9e8da] active:bg-[#bce0cf]",
  navy: "bg-white text-navy border-2 border-navy hover:bg-navy/5 active:bg-navy/10",
};

/** Request type → button color, per the resident styling spec. */
export const TYPE_VARIANT: Record<RequestType, ButtonVariant> = {
  Pain: "coral",
  Help: "teal",
  Mobility: "teal",
  Bathroom: "amber",
  "Medication Question": "amber",
  Water: "mint",
  Food: "mint",
  Custom: "navy",
};

export const TYPE_LABEL: Record<RequestType, string> = {
  Pain: "Pain",
  Help: "Help",
  Mobility: "Mobility",
  Bathroom: "Bathroom",
  "Medication Question": "Medication Question",
  Water: "Water",
  Food: "Food",
  Custom: "Custom Request",
};

export default function RequestButton({
  label,
  variant,
  onClick,
  disabled,
  icon,
  selected,
}: {
  label: string;
  variant: ButtonVariant;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={icon ? selected : undefined}
      className={`relative flex min-h-[88px] w-full flex-col items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-center text-base font-semibold shadow-soft transition-all disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${
        selected ? "ring-4 ring-navy/70 scale-[0.97]" : ""
      }`}
    >
      {selected && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-navy text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      )}
      {icon}
      <span className="leading-tight">{label}</span>
    </button>
  );
}
