import type { Status } from "@/lib/types";

const STYLES: Record<Status, string> = {
  New: "bg-navy/8 text-navy border-navy/20",
  Acknowledged: "bg-teal/10 text-teal border-teal/30",
  "In Progress": "bg-amber/15 text-[#9a6b00] border-amber/40",
  Resolved: "bg-success/12 text-success border-success/30",
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
