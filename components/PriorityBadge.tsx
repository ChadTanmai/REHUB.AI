import type { Priority } from "@/lib/types";

const STYLES: Record<Priority, string> = {
  Urgent: "bg-slate/8 text-slate border-slate/20",
  Important: "bg-slate/8 text-slate border-slate/20",
  Routine: "bg-slate/8 text-slate border-slate/20",
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
