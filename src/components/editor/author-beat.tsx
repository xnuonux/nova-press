"use client";

/**
 * author beat ... nova writing a whole beat into the page, on command.
 *
 * the generative counterpart to the ghost whisper. where the ghost continues
 * one line on a pause, the author drafts a finished beat (a paragraph) or an
 * outline when you ask it from the slash menu (expand / draft this beat /
 * outline). it streams in greyed, anchored just below the block you ran it on
 * (or above it when there's no room), the way the ghost feels ... tab weaves it
 * into the page, escape (or any edit) waves it off. it never touches the
 * document until you accept.
 *
 * the slash menu fires a `nova:author` event with the task, the note to work
 * from (the block's text), and the block index. this island owns the stream, the
 * preview, and the accept-insert ... so the slash menu stays a pure block-command
 * list and all the async lives in one place. the voice-keeper runs here at stream
 * end (lowercase / preamble / dash pass), PER beat line, before a character lands.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useEditorRef } from "platejs/react";

import { auditedLines } from "@/lib/ai/author-format";
import type { AuthorTask } from "@/lib/ai/provider";

interface AuthorEventDetail {
  task: AuthorTask;
  context: string;
  blockIndex: number;
}

interface BeatState {
  task: AuthorTask;
  blockIndex: number;
  text: string; // streamed text so far (dash-cleaned at the source)
  done: boolean;
  error: string | null;
  // exactly one of top / bottom is set ... below the block by default, flipped to
  // anchor above it (bottom) when there isn't room below, so a low or tall beat
  // never streams off the fold.
  top: number | null;
  bottom: number | null;
  left: number;
  width: number;
}

const LABEL: Record<AuthorTask, string> = {
  expand: "expanding",
  "draft-beat": "drafting",
  outline: "scaffolding",
};

export function AuthorBeat({ pieceId }: { pieceId: string }) {
  const editor = useEditorRef();
  const [beat, setBeat] = useState<BeatState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const genRef = useRef(0);
  const beatRef = useRef<BeatState | null>(null);
  beatRef.current = beat;

  // tear down any in-flight stream and hide the preview. bumping the generation
  // invalidates a stream that's still resolving.
  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    genRef.current += 1;
    if (beatRef.current) setBeat(null);
  }, []);

  const accept = useCallback(() => {
    const b = beatRef.current;
    if (!b || !b.done || b.error) return;
    const lines = auditedLines(b.task, b.text);
    cancel();
    if (lines.length === 0) return;
    const nodes = lines.map((line) => ({ type: "p", children: [{ text: line }] }));
    try {
      editor.tf.focus();
      // weave the beat in right after the block it was run on, clamped to the
      // current document length in case it shrank ... never over the writer's
      // note (non-destructive: their seed line stays).
      const at = Math.min(b.blockIndex + 1, editor.children.length);
      editor.tf.insertNodes(nodes, { at: [at], select: true });
    } catch {
      // transform api mismatch ... fail closed, leave the page untouched.
    }
  }, [editor, cancel]);

  // run a task: anchor near the block, then stream the beat from the author route.
  const run = useCallback(
    async (detail: AuthorEventDetail) => {
      cancel();
      const editable = document.querySelector('[data-slate-editor="true"]');
      const blockEl = editable?.children?.[detail.blockIndex] as HTMLElement | undefined;
      if (!editable || !blockEl) return;
      const rect = blockEl.getBoundingClientRect();
      const left = rect.left;
      const width = Math.max(220, rect.width);
      // below the block by default; if there isn't room, anchor above it (set
      // bottom, grow upward) so a low/tall beat stays on screen.
      const below = window.innerHeight - rect.bottom >= 220;
      const top = below ? rect.bottom + 6 : null;
      const bottom = below ? null : Math.max(8, window.innerHeight - rect.top + 6);

      const gen = ++genRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setBeat({
        task: detail.task,
        blockIndex: detail.blockIndex,
        text: "",
        done: false,
        error: null,
        top,
        bottom,
        left,
        width,
      });

      let res: Response;
      try {
        res = await fetch("/api/ai/author", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pieceId, task: detail.task, context: detail.context }),
          signal: controller.signal,
        });
      } catch {
        if (gen === genRef.current) setBeat(null); // aborted or offline ... go quiet
        return;
      }
      if (gen !== genRef.current) return;
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setBeat((b) =>
          b && gen === genRef.current
            ? { ...b, done: true, error: data.error ?? "nova couldn't write that one" }
            : b,
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (gen !== genRef.current) return;
          acc += decoder.decode(value, { stream: true });
          setBeat((b) => (b && gen === genRef.current ? { ...b, text: acc } : b));
        }
        acc += decoder.decode();
      } catch {
        if (gen === genRef.current) setBeat(null);
        return;
      }
      if (gen !== genRef.current) return;
      setBeat((b) =>
        b && gen === genRef.current
          ? {
              ...b,
              text: acc,
              done: true,
              error: auditedLines(b.task, acc).length === 0 ? "nova came back empty" : null,
            }
          : b,
      );
    },
    [pieceId, cancel],
  );

  // the slash menu's command to write. listen on the document so the menu stays
  // a pure list ... it just announces the task + the note + the block.
  useEffect(() => {
    const onAuthor = (event: Event) => {
      const detail = (event as CustomEvent<AuthorEventDetail>).detail;
      if (!detail || typeof detail.blockIndex !== "number") return;
      void run(detail);
    };
    document.addEventListener("nova:author", onAuthor);
    return () => document.removeEventListener("nova:author", onAuthor);
  }, [run]);

  // tab weaves it in, escape waves it off. capture phase so tab beats the
  // editor's own tab-indent, exactly like the ghost + slash menu ... and tab is
  // swallowed even mid-stream / on an error card so it never leaks a literal tab
  // into the note. scroll/resize dismiss too, except a scroll that originates
  // inside the card's own overflow.
  //
  // a real edit (nova:piece-edited, the same gated event the editorial panel
  // uses ... never a raw selectionchange, which would self-kill on slate's
  // re-applied selection) dismisses the beat ONCE IT'S DONE and sitting there ...
  // that's the long-lived window where the captured block index + the anchor can
  // go stale under the writer. while streaming we do NOT arm it: the summoning
  // slash-command's own delete + normalization echo would otherwise cancel the
  // beat the instant it appears.
  useEffect(() => {
    if (!beat) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (
        event.key === "Tab" &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (beat.done && !beat.error) accept();
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".np-author-beat")) return;
      cancel();
    };
    document.addEventListener("keydown", onKey, true);
    if (beat.done) document.addEventListener("nova:piece-edited", cancel);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", cancel);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("nova:piece-edited", cancel);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", cancel);
    };
  }, [beat, accept, cancel]);

  // tell the ghost whisper to stand down while a beat is on screen ... the
  // author has the writer's attention, and the two must never both claim tab.
  // fires idle again the moment the beat clears (accept / escape / edit), so the
  // whisper resumes. a value dep, so it only fires on the active<->idle edge.
  const active = !!beat;
  useEffect(() => {
    document.dispatchEvent(new CustomEvent(active ? "nova:author-active" : "nova:author-idle"));
  }, [active]);

  // abort an in-flight stream if the editor unmounts mid-beat.
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!beat) return null;
  const preview = beat.error ? beat.error : auditedLines(beat.task, beat.text).join("\n");
  const streaming = !beat.done;

  return createPortal(
    <div
      className="np-author-beat"
      data-testid="author-beat"
      style={{
        top: beat.top ?? undefined,
        bottom: beat.bottom ?? undefined,
        left: beat.left,
        width: beat.width,
      }}
    >
      <div className="np-author-beat-head">
        <span>nova ... {LABEL[beat.task]}</span>
        {beat.done ? (
          <span className="np-author-beat-keys">
            {beat.error ? "esc" : "tab to weave in · esc"}
          </span>
        ) : null}
      </div>
      <div className="np-author-beat-body" aria-busy={streaming} data-testid="author-beat-body">
        {preview}
        {streaming ? <span className="np-caret" aria-hidden /> : null}
      </div>
    </div>,
    document.body,
  );
}
