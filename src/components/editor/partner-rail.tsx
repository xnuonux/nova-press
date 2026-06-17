"use client";

/**
 * partner rail ... the AI panel, now a streaming conversation.
 *
 * you hand nova a line, nova ripostes in one finished sentence, in your voice,
 * streamed token by token the way the ghost whisper feels. the whole exchange
 * stays on screen as a thread, so it reads like sparring, not a one-shot oracle.
 *
 * state is the pure threadReducer (lib/ai/partner-thread, unit-tested). the
 * stream comes from /api/ai/command?stream, dash-safe at the source; the
 * voice-keeper runs here at stream end for the final lowercase + preamble pass
 * and the drift flag, same as the repurpose panel. the flow detector ducks this
 * whole rail while you're typing in the canvas (see globals.css .np-flow).
 *
 * not yet: multi-turn memory ... each riposte answers the latest line on its
 * own. threading the recent transcript into the prompt is a clean follow-up.
 */

import { useCallback, useEffect, useReducer, useRef, type FormEvent, type KeyboardEvent } from "react";

import { threadBusy, threadReducer, type PartnerMessage } from "@/lib/ai/partner-thread";
// pure module (regex only, no server deps), safe client-side ... it gives the
// streamed reply its final voice pass once the stream lands.
import { voiceKeeperAudit } from "@/lib/ai/voice-keeper";

export function PartnerRail() {
  const [messages, dispatch] = useReducer(threadReducer, []);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = threadBusy(messages);

  // abort an in-flight stream if the editor unmounts mid-reply.
  useEffect(() => () => abortRef.current?.abort(), []);

  // keep the newest turn in view as the thread grows and streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(() => {
    const el = inputRef.current;
    const context = el?.value.trim() ?? "";
    if (!context || threadBusy(messages)) return;

    const writerId = crypto.randomUUID();
    const novaId = crypto.randomUUID();
    if (el) el.value = "";
    dispatch({ type: "ask", writerId, novaId, text: context });

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    void (async () => {
      try {
        const res = await fetch("/api/ai/command", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ command: "respond", context, stream: true }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error("unreachable");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          if (acc.length > 0) dispatch({ type: "stream", id: novaId, text: acc });
        }
        acc += decoder.decode();
        if (controller.signal.aborted) return;

        // the dashes were stripped at the source; the keeper lowercases the
        // opening, strips any leaked preamble, holds the one-sentence cut, and
        // reports drift.
        const audited = voiceKeeperAudit(acc, { oneSentence: true });
        dispatch({ type: "settle", id: novaId, text: audited.text, drift: audited.violated });
      } catch {
        if (controller.signal.aborted) return;
        dispatch({ type: "fail", id: novaId });
      }
    })();
  }, [messages]);

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      send();
    },
    [send],
  );

  // enter sends, shift+enter writes a newline ... the chat reflex.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  return (
    <aside
      className="np-partner-rail hidden h-screen w-80 shrink-0 flex-col border-l lg:flex"
      style={{ background: "var(--lunari-bg-surface)", borderColor: "var(--lunari-border)" }}
    >
      <header
        className="flex items-center gap-3 border-b px-6 py-5"
        style={{ borderColor: "var(--lunari-border)" }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full font-serif text-sm font-medium"
          style={{ background: "var(--nova-accent)", color: "var(--lunari-bg-deep)" }}
        >
          N
        </div>
        <span className="font-serif text-base" style={{ color: "var(--lunari-fg-primary)" }}>
          nova
        </span>
        <span
          className="ml-auto h-1.5 w-1.5 rounded-full transition-colors"
          style={{ background: busy ? "var(--nova-accent)" : "var(--lunari-fg-subtle)" }}
          aria-hidden
        />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-7">
        {messages.length === 0 ? (
          <p
            className="font-serif text-base leading-relaxed"
            style={{ color: "var(--lunari-fg-muted)" }}
          >
            nova is listening.
          </p>
        ) : (
          <ol className="space-y-6">
            {messages.map((m) => (
              <Turn key={m.id} message={m} />
            ))}
          </ol>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-2 border-t px-6 py-5"
        style={{ borderColor: "var(--lunari-border)" }}
      >
        <textarea
          ref={inputRef}
          onKeyDown={onKeyDown}
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
          disabled={busy}
          className="np-btn w-full rounded-md px-3 py-2 font-sans text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--nova-accent)", color: "var(--lunari-bg-deep)" }}
        >
          {busy ? "..." : "ask nova"}
        </button>
      </form>

      <footer
        className="border-t px-6 py-4 font-mono text-[11px] uppercase tracking-[0.18em]"
        style={{ borderColor: "var(--lunari-border)", color: "var(--lunari-fg-subtle)" }}
      >
        one sentence, in your voice
      </footer>
    </aside>
  );
}

function Turn({ message }: { message: PartnerMessage }) {
  const isWriter = message.role === "writer";
  const label = isWriter ? "you" : "nova";
  // an open nova turn with no text yet is still "thinking"; once tokens land it
  // shows them with a live caret.
  const thinking = message.streaming && message.text.length === 0;

  return (
    <li className="np-partner-content space-y-1.5">
      <span
        className="font-mono text-[10px] uppercase tracking-[0.24em]"
        style={{ color: isWriter ? "var(--lunari-fg-subtle)" : "var(--nova-accent)" }}
      >
        {label}
      </span>

      {thinking ? (
        <p
          className="font-mono text-[11px] uppercase tracking-[0.22em]"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          thinking ...
        </p>
      ) : (
        <p
          className="font-serif text-base leading-relaxed"
          style={{
            color: isWriter ? "var(--lunari-fg-muted)" : "var(--lunari-fg-primary)",
          }}
        >
          {message.text}
          {message.streaming && message.text.length > 0 ? (
            <span className="np-caret" aria-hidden />
          ) : null}
        </p>
      )}

      {message.failed ? (
        <p
          className="font-serif text-sm leading-relaxed"
          style={{ color: "var(--lunari-fg-muted)" }}
        >
          nova couldn&apos;t reach the model ... try again in a sec.
        </p>
      ) : null}

      {message.drift ? (
        <p
          className="font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          voice drift ... nudge it again
        </p>
      ) : null}
    </li>
  );
}
