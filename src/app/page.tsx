import Link from "next/link";

import { Atmosphere } from "@/components/chrome/atmosphere";

const PILLARS = ["voice fidelity", "magazine reading", "multi-platform"];

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <Atmosphere />
      <div className="np-skyline absolute inset-x-0 top-0 h-px" aria-hidden />

      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 py-24 sm:px-10">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-start">
          <div
            className="np-rise np-rise-1 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.34em]"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--nova-accent)" }}
              aria-hidden
            />
            lunari titan
          </div>

          <h1
            className="np-rise np-rise-2 mt-7 font-serif text-6xl font-medium leading-[0.95] tracking-tight sm:text-7xl"
            style={{ color: "var(--lunari-fg-primary)" }}
          >
            nova press
          </h1>

          <p
            className="np-rise np-rise-3 mt-8 max-w-xl font-serif text-xl leading-relaxed sm:text-2xl"
            style={{ color: "var(--lunari-fg-muted)" }}
          >
            the writing studio where AI matches your voice, not the other way around. press is the
            editor, the partner, and the publication ... all in one.
          </p>

          <div className="np-rise np-rise-4 mt-11 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Link
              href="/library"
              className="inline-flex h-12 items-center justify-center rounded-md px-7 font-sans text-sm font-medium transition-all duration-200 hover:brightness-110"
              style={{
                background: "var(--nova-accent)",
                color: "var(--lunari-bg-deep)",
                boxShadow: "0 8px 24px -10px rgba(201, 168, 76, 0.7)",
              }}
            >
              start writing
            </Link>
            <Link
              href="/p/example"
              className="group inline-flex items-center gap-1.5 font-sans text-sm transition-colors"
              style={{ color: "var(--lunari-fg-muted)" }}
            >
              see a published piece
              <span
                className="transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              >
                &rarr;
              </span>
            </Link>
          </div>

          <div
            className="np-rise np-rise-5 mt-20 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-[0.26em]"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            {PILLARS.map((pillar, i) => (
              <span key={pillar} className="flex items-center gap-3">
                {i > 0 ? <span aria-hidden>·</span> : null}
                {pillar}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
