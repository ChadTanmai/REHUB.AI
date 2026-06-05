import type { Priority } from "@/lib/types";

const STYLES: Record<Priority, string> = {
  Urgent: "bg-coral/12 text-coral border-coral/30",
  Important: "bg-amber/15 text-[#9a6b00] border-amber/40",
  Routine: "bg-teal/10 text-teal border-teal/30",
};

export default function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${STYLES[priority]}`}
    >
      {priority}
    </span>
  );
}
