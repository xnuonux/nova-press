"use client";

/**
 * subscribe block ... the distribution capture on a published piece.
 *
 * a reader who just finished leaves their email; it's attributed to the writer
 * (the piece owner) server-side via /api/subscribe. single opt-in (basic, per
 * scope) ... double opt-in via resend is a later slice. print-hidden, since a
 * paper page has nothing to submit to.
 */

import { useState, type FormEvent } from "react";

type State = "idle" | "sending" | "done" | "error";

export function SubscribeBlock({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  // honeypot: a human leaves this empty; a bot auto-fills it and gets quietly
  // dropped server-side.
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<State>("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();
    if (!value || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, email: value, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      setState(res.ok && data.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <aside
      className="np-print-hide mx-auto mt-16 max-w-[65ch] rounded-2xl px-7 py-8 sm:px-9 sm:py-10"
      style={{
        background: "var(--lunari-bg-surface)",
        border: "1px solid var(--lunari-border)",
        boxShadow: "0 0 0 1px rgba(201,168,76,0.04), 0 30px 80px -50px rgba(0,0,0,0.6)",
      }}
    >
      <p
        className="font-mono text-[11px] uppercase tracking-[0.26em]"
        style={{ color: "var(--nova-accent)" }}
      >
        if this hit
      </p>
      <h2
        className="mt-3 font-serif text-2xl leading-snug tracking-tight sm:text-[1.65rem]"
        style={{ color: "var(--lunari-fg-primary)" }}
      >
        leave your email. the next one comes to you.
      </h2>

      {state === "done" ? (
        <p className="mt-5 font-serif text-base leading-relaxed" style={{ color: "var(--lunari-fg-muted)" }}>
          you&apos;re on the list ... see you next time.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* honeypot ... off-screen, untabbable, hidden from a11y tree. real
              readers never touch it; bots fill it and get dropped. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
            style={{ position: "absolute" }}
          />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="your email"
            className="h-11 w-full rounded-lg border px-4 font-serif text-base outline-none sm:max-w-[360px]"
            style={{
              background: "var(--lunari-bg-deep)",
              borderColor: "var(--lunari-border)",
              color: "var(--lunari-fg-primary)",
            }}
          />
          <button
            type="submit"
            disabled={state === "sending"}
            className="np-btn inline-flex h-11 shrink-0 items-center justify-center rounded-lg px-5 font-sans text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--nova-accent)", color: "var(--lunari-bg-deep)" }}
          >
            {state === "sending" ? "..." : "subscribe"}
          </button>
        </form>
      )}

      {state === "error" ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--lunari-fg-subtle)" }}>
          that didn&apos;t go through ... try again in a sec
        </p>
      ) : null}
    </aside>
  );
}
