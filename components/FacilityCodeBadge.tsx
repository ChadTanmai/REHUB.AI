"use client";

import { useState, useEffect, useRef } from "react";
import { useMounted } from "@/lib/useRehub";
import { getTherapistSession } from "@/lib/session";
import { useAuth } from "@/lib/auth/AuthProvider";

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}
function QrIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3M17 20v1M20 14v3M20 20h1" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default function FacilityCodeBadge() {
  const mounted = useMounted();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const modalRef = useRef<HTMLDivElement>(null);

  // Resolve code from session or profile
  const session = mounted ? getTherapistSession() : null;
  const facilityCode = session?.facilityCode ?? profile?.facilityCode ?? null;

  const joinUrl = typeof window !== "undefined" && facilityCode
    ? `${window.location.origin}/join/${facilityCode}`
    : "";

  // Generate QR code when modal opens
  useEffect(() => {
    if (!open || !joinUrl || qrDataUrl) return;
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(joinUrl, {
        width: 280,
        margin: 2,
        color: { dark: "#0F2B3D", light: "#FFFFFF" },
      }).then(setQrDataUrl).catch(() => {});
    });
  }, [open, joinUrl, qrDataUrl]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!mounted || !facilityCode) return null;

  function copyCode() {
    navigator.clipboard.writeText(facilityCode!).catch(() => {});
    setCopied("code");
    setTimeout(() => setCopied(null), 2000);
  }

  function copyLink() {
    navigator.clipboard.writeText(joinUrl).catch(() => {});
    setCopied("link");
    setTimeout(() => setCopied(null), 2000);
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({
        title: "Join my Rehub facility",
        text: `Use code ${facilityCode} or click the link to join:`,
        url: joinUrl,
      }).catch(() => {});
    } else {
      copyLink();
    }
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `rehub-${facilityCode}-qr.png`;
    a.click();
  }

  return (
    <div className="relative">
      {/* Badge trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-teal/30 bg-teal/8 px-2.5 py-1.5 text-xs font-bold text-teal transition-colors hover:bg-teal/15"
        title="Facility join code"
      >
        <span className="hidden font-mono sm:inline">{facilityCode}</span>
        <QrIcon />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div
            ref={modalRef}
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-muted bg-white shadow-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-muted px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-teal">Facility code</p>
                <p className="text-sm text-slate/60">Share this to let anyone join</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate/40 hover:bg-offwhite hover:text-navy"
              >
                <XIcon />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Big code */}
              <div className="rounded-xl border-2 border-dashed border-teal/40 bg-teal/5 p-4 text-center">
                <p className="font-mono text-3xl font-bold tracking-widest text-navy">
                  {facilityCode}
                </p>
                <p className="mt-1 text-xs text-slate/50">Facility join code</p>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={copyCode}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-muted bg-offwhite px-3 py-3 text-xs font-medium text-slate hover:border-navy/30 hover:bg-white transition-colors"
                >
                  <CopyIcon />
                  {copied === "code" ? "Copied!" : "Copy code"}
                </button>
                <button
                  onClick={copyLink}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-muted bg-offwhite px-3 py-3 text-xs font-medium text-slate hover:border-navy/30 hover:bg-white transition-colors"
                >
                  <CopyIcon />
                  {copied === "link" ? "Copied!" : "Copy link"}
                </button>
                <button
                  onClick={share}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-muted bg-offwhite px-3 py-3 text-xs font-medium text-slate hover:border-navy/30 hover:bg-white transition-colors"
                >
                  <ShareIcon />
                  Share
                </button>
              </div>

              {/* Join link */}
              <div className="rounded-lg border border-gray-muted bg-offwhite px-3 py-2.5">
                <p className="truncate font-mono text-xs text-slate/60">{joinUrl}</p>
              </div>

              {/* QR code */}
              <div className="flex flex-col items-center gap-3">
                {qrDataUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt={`QR code for ${facilityCode}`}
                      className="h-48 w-48 rounded-xl"
                    />
                    <button
                      onClick={downloadQr}
                      className="text-xs font-medium text-teal hover:underline"
                    >
                      Download QR code (PNG)
                    </button>
                  </>
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-gray-muted bg-offwhite">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                  </div>
                )}
                <p className="text-center text-xs text-slate/50">
                  Print and post in rooms, reception, and hallways
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
