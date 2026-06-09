"use client";

/**
 * partner rail ... the AI panel.
 *
 * slice 1: a minimal "hand nova a line" loop ... type a thought, nova
 * responds in one sentence, in voice, via /api/ai/command. proves the
 * provider -> voice-mirror prompt -> voice-keeper audit loop end to end.
 *
 * next slices: plate AIChatPlugin + ghost text in the canvas, the flow
 * detector that collapses this rail, the full chat thread.
 */

import { useState, type FormEvent } from "react";

type State = "idle" | "thinking" | "done" | "error";

export function PartnerRail() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [drift, setDrift] = useState(false);
  const [state, setState] = useState<State>("idle");

  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const context = input.trim();
    if (!context || state === "thinking") return;
    setState("thinking");
    setReply(null);
    setDrift(false);
    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: "respond", context }),
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      const data = (await res.json()) as { text: string; drift: boolean };
      setReply(data.text);
      setDrift(Boolean(data.drift));
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <aside
      className="hidden h-screen w-80 shrink-0 flex-col border-l lg:flex"
      style={{
        background: "var(--lunari-bg-surface)",
        borderColor: "var(--lunari-border)",
      }}
    >
      <header
        className="flex items-center gap-3 border-b px-6 py-5"
        style={{ borderColor: "var(--lunari-border)" }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full font-serif text-sm font-medium"
          style={{
            background: "var(--nova-accent)",
            color: "var(--lunari-bg-deep)",
          }}
        >
          N
        </div>
        <span className="font-serif text-base" style={{ color: "var(--lunari-fg-primary)" }}>
          nova
        </span>
        <span
          className="ml-auto h-1.5 w-1.5 rounded-full transition-colors"
          style={{
            background: state === "thinking" ? "var(--nova-accent)" : "var(--lunari-fg-subtle)",
          }}
          aria-hidden
        />
      </header>

      <div className="flex flex-1 flex-col px-6 py-8">
        <div className="min-h-[5rem] flex-1">
          {state === "idle" ? (
            <p
              className="font-serif text-base leading-relaxed"
              style={{ color: "var(--lunari-fg-muted)" }}
            >
              nova is listening.
            </p>
          ) : null}
          {state === "thinking" ? (
            <p
              className="font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: "var(--lunari-fg-subtle)" }}
            >
              thinking ...
            </p>
          ) : null}
          {state === "error" ? (
            <p
              className="font-serif text-base leading-relaxed"
              style={{ color: "var(--lunari-fg-muted)" }}
            >
              nova couldn&apos;t reach the model ... try again in a sec.
            </p>
          ) : null}
          {state === "done" && reply ? (
            <div className="space-y-3">
              <p
                className="font-serif text-base leading-relaxed"
                style={{ color: "var(--lunari-fg-primary)" }}
              >
                {reply}
              </p>
              {drift ? (
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.2em]"
                  style={{ color: "var(--lunari-fg-subtle)" }}
                >
                  voice drift ... nudge it again
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <form onSubmit={ask} className="mt-4 space-y-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="hand nova a line ..."
            rows={3}
            aria-label="ask nova"
            className="w-full resize-none rounded-md border px-3 py-2 font-serif text-sm leading-relaxed outline-none"
            style={{
              background: "var(--lunari-bg-deep)",
              borderColor: "var(--lunari-border)",
              color: "var(--lunari-fg-primary)",
            }}
          />
          <button
            type="submit"
            disabled={state === "thinking" || !input.trim()}
            className="w-full rounded-md px-3 py-2 font-sans text-sm font-medium transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: "var(--nova-accent)",
              color: "var(--lunari-bg-deep)",
            }}
          >
            {state === "thinking" ? "..." : "ask nova"}
          </button>
        </form>
      </div>

      <footer
        className="border-t px-6 py-4 font-mono text-[11px] uppercase tracking-[0.18em]"
        style={{
          borderColor: "var(--lunari-border)",
          color: "var(--lunari-fg-subtle)",
        }}
      >
        one sentence, in your voice
      </footer>
    </aside>
  );
}
