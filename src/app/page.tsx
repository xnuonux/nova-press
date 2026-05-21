import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="flex w-full max-w-xl flex-col items-start gap-8">
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono text-xs uppercase tracking-[0.32em]"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            lunari titan
          </span>
        </div>

        <h1
          className="font-mono text-5xl font-medium tracking-tight md:text-6xl"
          style={{ color: "var(--lunari-fg-primary)" }}
        >
          nova press
        </h1>

        <p
          className="font-serif text-lg leading-relaxed md:text-xl"
          style={{ color: "var(--lunari-fg-muted)" }}
        >
          the writing studio where AI matches your voice, not the other way around. press is the
          editor, the partner, and the publication ... all in one.
        </p>

        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Link
            href="/editor"
            className="inline-flex h-11 items-center justify-center rounded-md px-6 font-sans text-sm font-medium transition-colors"
            style={{
              background: "var(--nova-accent)",
              color: "var(--lunari-bg-deep)",
            }}
          >
            start writing
          </Link>
          <Link
            href="/p/example"
            className="font-sans text-sm transition-colors hover:underline"
            style={{ color: "var(--lunari-fg-muted)" }}
          >
            see a published piece
          </Link>
        </div>

        <div
          className="mt-16 flex flex-col gap-2 font-sans text-xs"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          <span>v0.1 · local dev</span>
          <span>voice rule: lowercase, no em-dashes, dom-voice always</span>
        </div>
      </div>
    </main>
  );
}
