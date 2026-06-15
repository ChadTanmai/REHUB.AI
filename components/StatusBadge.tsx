import type { Status } from "@/lib/types";

const STYLES: Record<Status, string> = {
  New: "bg-slate/8 text-slate border-slate/20",
  Acknowledged: "bg-slate/8 text-slate border-slate/20",
  "In Progress": "bg-slate/8 text-slate border-slate/20",
  Resolved: "bg-slate/8 text-slate border-slate/20",
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
