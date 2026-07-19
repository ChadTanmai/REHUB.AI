/**
 * Rehub brand mark.
 *
 * A clean, geometric mark that reads as both a "connection node" (rooms →
 * dashboard) and a subtle heartbeat/care signal. No clipart, no emoji.
 */

export function RehubMark({
  size = 28,
  animated = false,
}: {
  size?: number;
  /** Gives the hub node a slow, subtle heartbeat pulse — the mark already
   *  reads as a "care signal"; this makes that literal without adding any
   *  new visual language (reuses the existing rehub-breathe keyframe). */
  animated?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Rounded square base */}
      <rect width="32" height="32" rx="8" fill="#102A43" />
      {/* Connection lines (room → hub → dashboard) */}
      <path
        d="M8 20L13 14L19 18L24 12"
        stroke="#2F9E9E"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Node dots */}
      <circle cx="8" cy="20" r="2.2" fill="#D9F0E5" />
      <circle cx="13" cy="14" r="2.2" fill="#D9F0E5" />
      <circle
        cx="19"
        cy="18"
        r="2.2"
        fill="#2F9E9E"
        className={animated ? "rehub-mark-pulse" : undefined}
      />
      <circle cx="24" cy="12" r="2.2" fill="#D9F0E5" />
    </svg>
  );
}

export function RehubWordmark({
  size = "default",
}: {
  size?: "default" | "large" | "sm";
}) {
  const markSize = size === "large" ? 34 : size === "sm" ? 22 : 28;
  const textClass =
    size === "large"
      ? "text-xl font-bold tracking-tight text-navy"
      : size === "sm"
        ? "text-base font-bold tracking-tight text-navy"
        : "text-lg font-bold tracking-tight text-navy";
  return (
    <span className="flex items-center gap-2">
      <RehubMark size={markSize} />
      <span className={textClass}>
        rehub<span className="text-teal">.ai</span>
      </span>
    </span>
  );
}
