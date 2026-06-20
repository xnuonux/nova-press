"use client";

import { useEffect } from "react";

import { reportError } from "@/lib/observability/report-error";

// root error boundary. replaces the whole document when the root layout
// itself throws, so it renders its own html/body and leans on inline
// styles rather than the app's css. reports to sentry once a dsn is set.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { tag: "global-error", digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0f",
          color: "#f5f5f0",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <main style={{ maxWidth: 420, padding: "0 24px", textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 16px",
              color: "#c9a84c",
              fontSize: 12,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            nova press
          </p>
          <h1 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 400 }}>something broke</h1>
          <p
            style={{
              margin: "0 0 28px",
              color: "#8e8e98",
              fontSize: 16,
              lineHeight: 1.6,
            }}
          >
            not your fault. reload and it should come back.
          </p>
          <button
            onClick={() => reset()}
            style={{
              border: "none",
              borderRadius: 6,
              padding: "10px 22px",
              background: "#c9a84c",
              color: "#0a0a0f",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            reload
          </button>
        </main>
      </body>
    </html>
  );
}
