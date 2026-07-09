import type { NextConfig } from "next";

const PROD = process.env.NODE_ENV === "production";

/**
 * Security headers applied to every response.
 * CSP is strict but allows the Supabase and Vercel CDN origins needed for
 * fonts, scripts, and realtime WebSocket connections.
 */
const securityHeaders = [
  // Prevent browsers rendering page in a frame (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Block MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No referrer to external sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS for 1 year in production (includes subdomains)
  ...(PROD
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]
    : []),
  // Permissions policy — disable unused browser features
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(self), payment=()",
  },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: self + Vercel analytics inline scripts
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      // Styles: self + inline (Tailwind) + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts
      "font-src 'self' https://fonts.gstatic.com data:",
      // Images: self + data URIs
      "img-src 'self' data: blob: https:",
      // Connections: self + Supabase + Vercel analytics + WebSocket
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-analytics.com",
      // Workers (Supabase realtime uses a shared worker)
      "worker-src 'self' blob:",
      // No object/embed/base
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // Clickjacking defense in depth (pairs with X-Frame-Options: DENY)
      "frame-ancestors 'none'",
      // Upgrade HTTP to HTTPS
      ...(PROD ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
  // Prevent cross-origin opener attacks
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Prevent cross-origin embedding of resources
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Security headers on every route
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Allow all devices on the local network to load JS/CSS assets in dev mode.
  allowedDevOrigins: [
    "192.168.12.106",
    "192.168.1.*",
    "192.168.0.*",
    "10.0.0.*",
    "10.0.1.*",
  ],

  // Hardened production settings
  poweredByHeader: false,          // Remove X-Powered-By: Next.js
  compress: true,                   // Gzip responses
  reactStrictMode: true,            // Catch double-render issues in dev
};

export default nextConfig;
