"use client";

/**
 * voice trainer ... the "train nova on your voice" control.
 *
 * one tap distills the fingerprint of your own pieces into voice_profiles
 * (POST /api/voice/extract), which then feeds the partner, the ghost whisper,
 * and the repurpose engine. this is what turns the now-wired voice wedge from
 * "not yet trained" into nova actually mirroring you.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

type State = "idle" | "training" | "done" | "error";

export function VoiceTrainer() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function train() {
    if (state === "training") return;
    setState("training");
    setMessage(null);
    try {
      const res = await fetch("/api/voice/extract", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        summary?: string | null;
        error?: string;
      };
      if (res.ok && data.ok) {
        setState("done");
        setMessage(data.summary ? `nova hears it ... ${data.summary}` : "nova learned your voice.");
        // a fresh extraction just dropped a new snapshot ... re-run the server
        // read so "your voice over time" shows the dot without a manual reload.
        router.refresh();
      } else {
        setState("error");
        setMessage(data.error ?? "couldn't train your voice");
      }
    } catch {
      setState("error");
      setMessage("couldn't reach nova ... try again in a sec");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={train}
        disabled={state === "training"}
        className="np-btn inline-flex h-9 items-center rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: "var(--nova-accent-soft)",
          color: "var(--nova-accent)",
          border: "1px solid color-mix(in srgb, var(--nova-accent) 28%, transparent)",
        }}
      >
        {state === "training"
          ? "learning ..."
          : state === "done"
            ? "voice trained"
            : "train nova on your voice"}
      </button>
      {message ? (
        <span
          className="font-serif text-sm leading-relaxed"
          style={{
            color: state === "error" ? "var(--lunari-fg-subtle)" : "var(--lunari-fg-muted)",
          }}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
