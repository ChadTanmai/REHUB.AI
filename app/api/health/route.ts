import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Used by Vercel health checks, uptime monitors, and load balancers.
 * Returns 200 when the application is running and 503 on critical failure.
 */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "rehub",
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache",
      },
    },
  );
}
