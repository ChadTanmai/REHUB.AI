/**
 * Simple, high-contrast line icons for the resident quick-request buttons.
 * Flat stroke icons only — no fills, no gradients — so they stay legible at
 * small sizes and read clearly against any of the five button variants.
 */

type IconProps = { className?: string };
const BASE = "h-7 w-7 shrink-0";

export function NurseIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

export function WaterIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2.5S5 11 5 15.5a7 7 0 0014 0C19 11 12 2.5 12 2.5z" />
    </svg>
  );
}

export function PainIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export function BathroomIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4v4M17 4v4M5 8h14l-1.2 11a2 2 0 01-2 1.8H8.2a2 2 0 01-2-1.8L5 8z" />
    </svg>
  );
}

export function FoodIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2v7a2 2 0 004 0V2M8 9v13M18 2c-2 1-3 3-3 6s1 3 3 3v11" />
    </svg>
  );
}

export function MedicationIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="9.5" width="17" height="8" rx="4" transform="rotate(-30 12 13.5)" />
      <path d="M9 11l5.5 4.7" />
    </svg>
  );
}

export function MobilityIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="13" cy="4" r="1.6" fill="currentColor" stroke="none" />
      <path d="M10 21l1.5-6-2.5-2 1-5 3.5 2 2 3.5h3M9 13l-3 1.5V19" />
    </svg>
  );
}

export function BlanketIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 5h18v10a4 4 0 01-4 4H3V5z" />
      <path d="M3 10h18M8 5v14" />
    </svg>
  );
}

export function PositionChangeIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 0115-6.7M21 12a9 9 0 01-15 6.7" />
      <path d="M17 2v4h-4M7 22v-4h4" />
    </svg>
  );
}

export function TooColdIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v20M5 6l14 12M19 6L5 18M2 12h20" />
    </svg>
  );
}

export function TooHotIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1.5v3M12 19.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1.5 12h3M19.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

export function FamilyIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

export function TechnicalHelpIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a4 4 0 01-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 015.4-5.4l-2.6 2.6-2-2 2.6-2.6z" />
    </svg>
  );
}

export function TelevisionIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="4.5" width="19" height="13" rx="2" />
      <path d="M8 21h8M12 17.5V21" />
    </svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 2.5h4l1.5 5-2.3 1.4a11.5 11.5 0 007.9 7.9l1.4-2.3 5 1.5v4a2 2 0 01-2.2 2A18.5 18.5 0 012 4.7 2 2 0 014 2.5z" />
    </svg>
  );
}

export function CustomIcon({ className }: IconProps) {
  return (
    <svg className={className ?? BASE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
