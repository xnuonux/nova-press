"use client";

/**
 * repurpose launcher ... nova's flagship move.
 *
 * one finished piece, recompiled into a newsletter, an x thread, and a
 * linkedin post, every variant in the writer's voice (voice-keeper enforced
 * server-side). a button in the editor chrome opens an overlay; each format
 * streams in independently (one fetch per tab) so the panel fills as the model
 * lands. ephemeral ... nothing is persisted, so there's no shared substrate.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { RepurposeFormat } from "@/lib/ai/prompts/repurpose-prompt";
// pure module (regex only, no server deps), safe to run client-side. it gives
// the streamed text its final voice pass once the stream lands.
import { voiceKeeperAudit } from "@/lib/ai/voice-keeper";

interface Tab {
  key: RepurposeFormat;
  label: string;
  blurb: string;
}

// kept local + tiny so this client component never reaches into the server
// prompt module. the source of truth for behaviour still lives server-side.
const TABS: Tab[] = [
  { key: "newsletter", label: "newsletter", blurb: "an email to your subscribers" },
  { key: "thread", label: "x thread", blurb: "a thread for x / twitter" },
  { key: "linkedin", label: "linkedin", blurb: "a post for linkedin" },
];

type VariantState =
  | { status: "loading" }
  | { status: "streaming"; text: string }
  | { status: "done"; text: string; drift: boolean }
  | { status: "error"; error: string };

interface Source {
  title: string;
  source: string;
}

export function RepurposeLauncher({ getSource }: { getSource: () => Source }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="np-btn inline-flex h-8 items-center rounded-full px-3.5 font-mono text-[11px] uppercase tracking-[0.18em]"
        style={{
          background: "var(--nova-accent-soft)",
          color: "var(--nova-accent)",
          border: "1px solid color-mix(in srgb, var(--nova-accent) 28%, transparent)",
        }}
      >
        repurpose
      </button>
      {open ? <RepurposePanel getSource={getSource} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function RepurposePanel({ getSource, onClose }: { getSource: () => Source; onClose: () => void }) {
  const [active, setActive] = useState<RepurposeFormat>("newsletter");
  const [variants, setVariants] = useState<Record<RepurposeFormat, VariantState>>({
    newsletter: { status: "loading" },
    thread: { status: "loading" },
    linkedin: { status: "loading" },
  });
  const [copied, setCopied] = useState(false);
  const sourceRef = useRef<Source>(getSource());
  // one in-flight stream per format. regenerate aborts the previous; closing
  // the panel aborts them all ... no setState after unmount, no old stream
  // clobbering a new one.
  const controllersRef = useRef<Partial<Record<RepurposeFormat, AbortController>>>({});

  const runFormat = useCallback((format: RepurposeFormat, src: Source) => {
    controllersRef.current[format]?.abort();
    const controller = new AbortController();
    controllersRef.current[format] = controller;
    setVariants((prev) => ({ ...prev, [format]: { status: "loading" } }));
    void (async () => {
      try {
        const res = await fetch("/api/ai/repurpose", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: src.title,
            source: src.source,
            formats: [format],
            stream: true,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "nova couldn't repurpose this one");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          // only flip to streaming once there's something to show, so the
          // shimmer doesn't blink to an empty pane.
          if (acc.length > 0) {
            const text = acc;
            setVariants((prev) => ({ ...prev, [format]: { status: "streaming", text } }));
          }
        }
        acc += decoder.decode();

        // the stream can finish right as the panel closes or regenerate
        // fires; bail before the final setState so we never write to an
        // unmounted panel or clobber a newer run.
        if (controller.signal.aborted) return;

        // the dashes were stripped at the source; the keeper does the rest
        // (lowercase paragraph openings, any preamble) + reports drift.
        const audited = voiceKeeperAudit(acc);
        setVariants((prev) => ({
          ...prev,
          [format]: { status: "done", text: audited.text, drift: audited.violated },
        }));
      } catch (err: unknown) {
        // an intentional abort (regenerate / close) is not an error.
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "something broke";
        setVariants((prev) => ({ ...prev, [format]: { status: "error", error: message } }));
      }
    })();
  }, []);

  // abort every in-flight stream when the panel unmounts. the ref object is
  // stable (we only ever mutate its entries, never reassign .current), so this
  // captured reference still sees the latest controllers at cleanup time.
  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of Object.values(controllers)) controller?.abort();
    };
  }, []);

  // fire all three on open, in parallel. each tab fills as it lands.
  useEffect(() => {
    const src = getSource();
    sourceRef.current = src;
    if (!src.source.trim()) {
      setVariants({
        newsletter: { status: "error", error: "write something first" },
        thread: { status: "error", error: "write something first" },
        linkedin: { status: "error", error: "write something first" },
      });
      return;
    }
    for (const tab of TABS) runFormat(tab.key, src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // esc closes.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = variants[active];

  const copy = useCallback(() => {
    if (current.status !== "done") return;
    void navigator.clipboard.writeText(current.text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }, [current]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: "rgba(5, 5, 9, 0.62)", backdropFilter: "blur(6px)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="np-repurpose-sheet relative my-auto w-full max-w-2xl rounded-2xl"
        style={{
          background: "var(--lunari-bg-surface)",
          border: "1px solid var(--lunari-border)",
          boxShadow: "0 40px 120px -40px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.04)",
        }}
      >
        {/* header */}
        <div
          className="flex items-start justify-between gap-4 border-b px-7 py-5"
          style={{ borderColor: "var(--lunari-border)" }}
        >
          <div>
            <h2
              className="font-serif text-2xl tracking-tight"
              style={{ color: "var(--lunari-fg-primary)" }}
            >
              repurpose
            </h2>
            <p className="mt-1 font-serif text-sm" style={{ color: "var(--lunari-fg-muted)" }}>
              one piece, every platform ... still your voice.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="-mr-1 -mt-1 rounded-md px-2 py-1 font-mono text-lg leading-none transition-opacity hover:opacity-70"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            ×
          </button>
        </div>

        {/* tabs */}
        <div className="flex gap-1 px-5 pt-4">
          {TABS.map((tab) => {
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                className="rounded-lg px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-all duration-200"
                style={
                  isActive
                    ? { background: "var(--nova-accent-soft)", color: "var(--nova-accent)" }
                    : { color: "var(--lunari-fg-subtle)" }
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* body */}
        <div className="px-7 pb-7 pt-4">
          <VariantView state={current} onRetry={() => runFormat(active, sourceRef.current)} />
        </div>

        {/* footer actions */}
        <div
          className="flex items-center justify-between gap-3 border-t px-7 py-4"
          style={{ borderColor: "var(--lunari-border)" }}
        >
          <button
            type="button"
            onClick={() => runFormat(active, sourceRef.current)}
            disabled={current.status === "loading" || current.status === "streaming"}
            className="font-mono text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            regenerate
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={current.status !== "done"}
            className="np-btn inline-flex h-9 items-center rounded-md px-4 font-sans text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--nova-accent)", color: "var(--lunari-bg-deep)" }}
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VariantView({ state, onRetry }: { state: VariantState; onRetry: () => void }) {
  const preRef = useRef<HTMLPreElement>(null);
  const liveText = state.status === "streaming" || state.status === "done" ? state.text : "";
  // keep the live caret in view as text streams past the bottom of the box.
  useEffect(() => {
    if (state.status === "streaming" && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [state.status, liveText]);

  if (state.status === "loading") {
    return (
      <div className="space-y-3 py-4" aria-label="generating">
        {[92, 78, 85, 64, 88, 71].map((w, i) => (
          <div
            key={i}
            className="np-shimmer h-3.5 rounded"
            style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }}
          />
        ))}
        <p
          className="pt-2 font-mono text-[11px] uppercase tracking-[0.2em]"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          nova... recompiling
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="py-8 text-center">
        <p className="font-serif text-base" style={{ color: "var(--lunari-fg-muted)" }}>
          {state.error}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-70"
          style={{ color: "var(--nova-accent)" }}
        >
          try again
        </button>
      </div>
    );
  }

  // streaming: the text so far, with a live caret. done: the final audited
  // text + the drift note if the keeper had to step in.
  const streaming = state.status === "streaming";
  return (
    <div>
      {state.status === "done" && state.drift ? (
        <p
          className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          voice drift caught + corrected
        </p>
      ) : null}
      <pre
        ref={preRef}
        className="max-h-[46vh] overflow-y-auto whitespace-pre-wrap font-serif text-[15px] leading-relaxed"
        style={{ color: "var(--lunari-fg-primary)" }}
        aria-busy={streaming}
      >
        {state.text}
        {streaming ? <span className="np-caret" aria-hidden /> : null}
      </pre>
    </div>
  );
}
