"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Atmosphere } from "@/components/chrome/atmosphere";
import { reportError } from "@/lib/observability/report-error";

// graceful boundary for the authed tree (library, editor). a thrown
// server component renders this inside the root layout instead of
// taking down the whole document. reports to sentry once a dsn is set.
export default function AuthedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { tag: "authed-error", digest: error.digest });
  }, [error]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <Atmosphere />
      <div className="relative z-10 flex flex-col items-center gap-7">
        <div className="space-y-3">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.3em]"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            nova press
          </p>
          <h1
            className="font-serif text-3xl font-medium tracking-tight"
            style={{ color: "var(--lunari-fg-primary)" }}
          >
            this corner broke
          </h1>
          <p
            className="font-serif text-lg leading-relaxed"
            style={{ color: "var(--lunari-fg-muted)" }}
          >
            reload it, or head back to your pieces.
          </p>
        </div>
        <div className="flex items-center gap-5">
          <button
            onClick={() => reset()}
            className="inline-flex h-11 items-center rounded-md px-6 font-sans text-sm font-medium transition-all duration-200 hover:brightness-110"
            style={{
              background: "var(--nova-accent)",
              color: "var(--lunari-bg-deep)",
              boxShadow: "0 8px 24px -12px rgba(201, 168, 76, 0.7)",
            }}
          >
            reload
          </button>
          <Link
            href="/library"
            className="font-sans text-sm transition-colors hover:opacity-80"
            style={{ color: "var(--lunari-fg-muted)" }}
          >
            your pieces
          </Link>
        </div>
      </div>
    </main>
  );
}
