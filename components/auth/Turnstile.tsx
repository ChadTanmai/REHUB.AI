"use client";

/**
 * Cloudflare Turnstile widget for bot / credential-stuffing protection on the
 * auth forms. Invisible-friendly, privacy-preserving CAPTCHA.
 *
 * ACTIVATION (no key manipulation needed in code):
 *   1. Create a free Turnstile widget at dash.cloudflare.com → Turnstile.
 *   2. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY (this widget) and, in the Supabase
 *      dashboard → Authentication → Bot protection, enable Turnstile and paste
 *      the SECRET key there (Supabase verifies the token server-side).
 *
 * GRACEFUL DEGRADATION: with no site key set, this renders nothing and
 * `turnstileEnabled` is false — the auth forms work exactly as before. It only
 * activates once the key is present, so it can never break the current login.
 */

import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** True when a site key is configured — forms can gate submit on a token. */
export const turnstileEnabled = Boolean(SITE_KEY);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { turnstile?: any } }

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !holder.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(holder.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => onToken(token),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
      });
    };

    if (window.turnstile) {
      render();
    } else if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      // Script tag exists but API not ready yet — poll briefly.
      const t = setInterval(() => {
        if (window.turnstile) { clearInterval(t); render(); }
      }, 200);
      setTimeout(() => clearInterval(t), 5000);
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* ignore */ }
      }
    };
  }, [onToken]);

  if (!SITE_KEY) return null;
  return <div ref={holder} className="my-2 flex justify-center" />;
}
