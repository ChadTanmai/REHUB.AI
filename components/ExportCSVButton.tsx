"use client";

import type { Request } from "@/lib/types";
import { toCSV } from "@/lib/analyticsUtils";

/**
 * Exports requests to a CSV file. Generated and downloaded entirely in the
 * browser — no data is uploaded anywhere.
 */

export default function ExportCSVButton({
  requests,
  filename = "rehub-requests.csv",
}: {
  requests: Request[];
  filename?: string;
}) {
  function handleExport() {
    const csv = toCSV(requests);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="rounded-lg border-2 border-navy bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-navy/5"
    >
      Export CSV
    </button>
  );
}
