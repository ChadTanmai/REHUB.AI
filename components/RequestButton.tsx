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
}: {
  label: string;
  variant: ButtonVariant;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[64px] w-full rounded-xl px-5 text-lg font-semibold shadow-soft transition-colors disabled:opacity-50 ${VARIANT_CLASSES[variant]}`}
    >
      {label}
    </button>
  );
}
