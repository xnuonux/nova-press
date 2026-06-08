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
    return <p className="text-muted-foreground text-sm">link sent ... check your inbox.</p>;
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
        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={state === "sending" || !email}
        className="w-full rounded-md bg-[#c9a84c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#b8983e] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "sending" ? "sending..." : "send the link"}
      </button>
      {state === "error" && errorMessage ? (
        <p className="text-destructive text-sm">{errorMessage}</p>
      ) : null}
    </form>
  );
}

function buildCallbackUrl(next?: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}
