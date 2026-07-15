"use client";

/**
 * Global error boundary — catches errors in the root layout itself (RSC errors).
 * Must include its own <html> and <body> since the layout may be unavailable.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f5f7fa", margin: 0 }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100vh", padding: "1.5rem",
        }}>
          <div style={{
            background: "#fff", borderRadius: "1rem", border: "1px solid #e2e8f0",
            padding: "2.5rem", maxWidth: "24rem", width: "100%", textAlign: "center",
          }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2f9e9e",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              rehub.ai
            </p>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#102a43", marginBottom: "0.5rem" }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem" }}>
              An unexpected error occurred. Your data is safe — please try reloading.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  background: "#102a43", color: "#fff", border: "none",
                  borderRadius: "0.5rem", padding: "0.6rem 1.25rem",
                  fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                Reload
              </button>
              {/* Real <a>, not next/link — this boundary fires when the root
                  layout itself has crashed, so the app's client-side router
                  may not be reliable. A plain browser navigation is the
                  safer "get me out of here" fallback. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                style={{
                  background: "#f5f7fa", color: "#102a43", border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem", padding: "0.6rem 1.25rem",
                  fontSize: "0.875rem", fontWeight: 600, textDecoration: "none",
                }}
              >
                Go home
              </a>
            </div>
            {error.digest && (
              <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "1rem" }}>
                Ref: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
