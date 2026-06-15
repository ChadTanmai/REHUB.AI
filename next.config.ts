import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow all devices on the local network to load JS/CSS assets in dev mode.
  // Next.js 16 blocks cross-origin dev resources by default — this opens it
  // for the local subnet so phones and tablets can connect over WiFi.
  allowedDevOrigins: [
    "192.168.12.106",
    "192.168.1.*",
    "192.168.0.*",
    "10.0.0.*",
    "10.0.1.*",
  ],
};

export default nextConfig;
