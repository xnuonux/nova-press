"use client";

import { useState, type FormEvent } from "react";

import { reportError } from "@/lib/observability/report-error";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type State = "idle" | "sending" | "sent" | "error";

// map supabase auth error wording to nova-voice strings. supabase error
// messages are not a stable api surface (sentence-cased, period-
// terminated, can leak rate-limit windows + signup-allowlist state) so
// we never render error.message raw.
function novaVoiceErrorFor(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("for security purposes")) {
    return "too many tries ... wait a minute and try again.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "that email doesn't look right.";
  }
  if (m.includes("signups not allowed")) {
    return "signups are paused right now.";
  }
  return "something broke on our end ... try again in a sec.";
}

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || state === "sending") return;
    setState("sending");
    setErrorMessage(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: buildCallbackUrl(next) },
    });

    if (error) {
      // raw error goes to sentry + console for debugging; the user only
      // ever sees the voice-mapped version.
      reportError(error, { tag: "signin-with-otp-failed" });
      setState("error");
      setErrorMessage(novaVoiceErrorFor(error.message));
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div
        className="rounded-lg border px-5 py-6 font-serif text-lg leading-relaxed"
        style={{
          borderColor: "var(--lunari-border)",
          background: "var(--nova-accent-soft)",
          color: "var(--lunari-fg-primary)",
        }}
      >
        link sent ... check your inbox.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="email" className="sr-only">
        your email
      </label>
      <input
        id="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your email"
        disabled={state === "sending"}
        className="w-full rounded-md border px-4 py-3 font-sans text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: "var(--lunari-bg-surface)",
          borderColor: "var(--lunari-border)",
          color: "var(--lunari-fg-primary)",
        }}
      />
      <button
        type="submit"
        disabled={state === "sending" || !email}
        className="w-full rounded-md px-4 py-3 font-sans text-sm font-medium transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          background: "var(--nova-accent)",
          color: "var(--lunari-bg-deep)",
          boxShadow: "0 8px 24px -12px rgba(201, 168, 76, 0.7)",
        }}
      >
        {state === "sending" ? "sending..." : "send the link"}
      </button>
      {state === "error" && errorMessage ? (
        <p className="font-sans text-sm" style={{ color: "var(--nova-accent)" }}>
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}

function buildCallbackUrl(next?: string): string {
  // `next` arrives already run through sanitizeNextPath (same-origin path
  // only) on the server before it reaches this client form, and the
  // callback re-sanitizes it before redirecting. it's only ever a query
  // param here, never a redirect target, so it can't open-redirect.
  const url = new URL("/auth/callback", window.location.origin);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}
