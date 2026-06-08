"use client";

import Link from "next/link";
import { useEffect } from "react";

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[#c9a84c]">nova press</p>
        <h1 className="font-serif text-2xl">this corner broke</h1>
        <p className="text-muted-foreground text-sm">reload it, or head back to your pieces.</p>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => reset()}
          className="rounded-md bg-[#c9a84c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#b8983e]"
        >
          reload
        </button>
        <Link href="/library" className="text-muted-foreground text-sm hover:underline">
          your pieces
        </Link>
      </div>
    </main>
  );
}
