/**
 * The Rehub safety note. Visible across the product so the positioning is never
 * ambiguous: Rehub is a communication tool, not an emergency or medical system.
 */

export default function SafetyNote({
  variant = "default",
  className = "",
}: {
  variant?: "default" | "compact" | "emergency";
  className?: string;
}) {
  if (variant === "emergency") {
    return (
      <div
        className={`rounded-lg border border-coral/40 bg-coral/8 px-4 py-3 text-sm text-slate ${className}`}
      >
        <span className="font-semibold text-coral">Staff has been notified.</span>{" "}
        If this is life-threatening, use the facility emergency call system.
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <p className={`text-xs leading-relaxed text-slate/70 ${className}`}>
        Rehub notifies staff but does not replace the facility emergency call
        system.
      </p>
    );
  }

  return (
    <div
      className={`rounded-lg border border-gray-muted bg-white px-4 py-3 text-sm text-slate/80 ${className}`}
    >
      Rehub is a communication and workflow tool. It does not replace emergency
      response systems or medical judgment.
    </div>
  );
}
