"use client";

/**
 * ghost text ... nova's inline whisper.
 *
 * pause for a beat at the end of a line and a one-sentence continuation fades
 * in, greyed, right where the caret sits. tab takes it, any keystroke waves it
 * off. it streams in token by token (the x article ghostwriter feel) and never
 * touches the document until you accept ... it's a pure dom overlay measured off
 * the selection rect, so plate's value stays clean (no decorations, no
 * normalization games).
 *
 * trigger: 1.2s pause, collapsed caret at the end of a paragraph (not a
 * heading, not a divider, not mid-line), at least a few words of context.
 * cancel: any caret move, type, click, or scroll. accept: tab (capture phase,
 * so it beats the editor's own tab-indent). dismiss: escape.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useEditorRef } from "platejs/react";

import { joinGhost } from "@/lib/ai/ghost-format";

const DEBOUNCE_MS = 1200;
const MIN_CONTEXT = 15;
const MAX_CONTEXT = 1500;
const SKIP_BLOCKS = new Set(["h1", "h2", "h3", "hr"]);
const SLASH_RUN = /(?:^|\s)\/[a-zA-Z0-9]*$/;

interface GhostState {
  raw: string; // server text so far, already dash-cleaned
  ctx: string; // the block text up to the caret, captured at request time
  top: number;
  left: number;
  maxWidth: number;
  fontSize: string;
  lineHeight: string;
  fontFamily: string;
}

export function GhostText() {
  const editor = useEditorRef();
  const [ghost, setGhost] = useState<GhostState | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const genRef = useRef(0);
  const ghostRef = useRef<GhostState | null>(null);
  ghostRef.current = ghost;

  // tear down any pending timer + in-flight stream and hide the suggestion.
  // bumping the generation invalidates a stream that's still resolving.
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    genRef.current += 1;
    if (ghostRef.current) setGhost(null);
  }, []);

  const request = useCallback(async () => {
    // re-validate at fire time ... the caret may have moved during the wait.
    const domSel = window.getSelection();
    if (!domSel || !domSel.isCollapsed || domSel.rangeCount === 0) return;
    const selection = editor.selection;
    if (!selection) return;

    const editable = document.querySelector('[data-slate-editor="true"]');
    const range = domSel.getRangeAt(0);
    if (!editable || !editable.contains(range.commonAncestorContainer)) return;
    // only whisper while the writer is actually in the editor. if a modal
    // (repurpose, cmd+k) is open or the editor is blurred, stay silent ... a
    // suggestion firing into a blurred surface is both wrong and a needless
    // render churn behind the overlay.
    if (!editable.contains(document.activeElement)) return;

    let ctx = "";
    try {
      const blockIdx = selection.anchor.path[0] ?? 0;
      const block = editor.children[blockIdx] as { type?: string } | undefined;
      if (!block || SKIP_BLOCKS.has(block.type ?? "")) return;

      // text from block start to the caret, and the whole block. when the two
      // are the same length the caret sits at the end of the line ... we only
      // continue a line, never splice into the middle of it. (uses just
      // api.string, the one transform we know plate v49 exposes here.)
      const blockStart = { path: [blockIdx, 0], offset: 0 };
      ctx = editor.api.string({ anchor: blockStart, focus: selection.anchor });
      const whole = editor.api.string([blockIdx]);
      if (ctx.length < whole.length) return;
    } catch {
      return;
    }
    if (ctx.trim().length < MIN_CONTEXT) return;
    if (SLASH_RUN.test(ctx)) return; // the slash menu owns this run

    const rect = range.getBoundingClientRect();
    const top = rect.top;
    const left = rect.left;
    const host =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : (range.startContainer as Element);
    const cs = host ? getComputedStyle(host) : null;
    const fontSize = cs?.fontSize ?? "20px";
    const lineHeight = cs?.lineHeight ?? "1.7";
    const fontFamily = cs?.fontFamily ?? "Georgia, serif";
    const bodyRect = editable.getBoundingClientRect();
    const maxWidth = Math.max(140, bodyRect.right - left - 4);

    const gen = ++genRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    let res: Response;
    try {
      res = await fetch("/api/ai/ghost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: ctx.slice(-MAX_CONTEXT) }),
        signal: controller.signal,
      });
    } catch {
      return; // aborted or offline ... stay quiet
    }
    if (gen !== genRef.current) return;
    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (gen !== genRef.current) return;
        acc += decoder.decode(value, { stream: true });
        if (joinGhost(ctx, acc)) {
          setGhost({ raw: acc, ctx, top, left, maxWidth, fontSize, lineHeight, fontFamily });
        }
      }
      acc += decoder.decode(); // flush any trailing multi-byte char
    } catch {
      return;
    }
    if (gen !== genRef.current) return;
    if (joinGhost(ctx, acc)) {
      setGhost({ raw: acc, ctx, top, left, maxWidth, fontSize, lineHeight, fontFamily });
    } else {
      setGhost(null);
    }
  }, [editor]);

  // any caret move / type / click / scroll cancels the current whisper and
  // restarts the quiet timer ... it only ever appears on a pause.
  const schedule = useCallback(() => {
    cancel();
    // don't even arm the timer unless the editor holds focus ... blur events
    // (a modal opening) fire selectionchange too, and we should go quiet, not
    // queue a suggestion for a surface the writer just left.
    const editable = document.querySelector('[data-slate-editor="true"]');
    if (!editable || !editable.contains(document.activeElement)) return;
    timerRef.current = setTimeout(() => {
      void request();
    }, DEBOUNCE_MS);
  }, [cancel, request]);

  useEffect(() => {
    document.addEventListener("selectionchange", schedule);
    window.addEventListener("scroll", cancel, true);
    window.addEventListener("resize", cancel);
    return () => {
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", cancel, true);
      window.removeEventListener("resize", cancel);
      cancel();
    };
  }, [schedule, cancel]);

  const accept = useCallback(() => {
    const g = ghostRef.current;
    if (!g) return;
    const text = joinGhost(g.ctx, g.raw);
    cancel();
    if (!text) return;
    try {
      editor.tf.focus();
      editor.tf.insertText(text);
    } catch {
      // transform mismatch ... fail closed
    }
  }, [editor, cancel]);

  // accept on tab, dismiss on escape. capture phase so tab beats the editor's
  // own tab-indent and the browser default, exactly like the slash menu.
  useEffect(() => {
    if (!ghost) return;
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
        accept();
      } else if (event.key === "Escape") {
        // dismiss the whisper but let escape keep bubbling ... the shell uses it
        // to leave focus / typewriter mode, so one press should do both.
        cancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [ghost, accept, cancel]);

  if (!ghost) return null;
  const text = joinGhost(ghost.ctx, ghost.raw);
  if (!text) return null;

  return createPortal(
    <div
      className="np-ghost"
      aria-hidden
      data-np-ghost="true"
      style={{
        top: ghost.top,
        left: ghost.left,
        maxWidth: ghost.maxWidth,
        fontSize: ghost.fontSize,
        lineHeight: ghost.lineHeight,
        fontFamily: ghost.fontFamily,
      }}
    >
      <span className="np-ghost-text">{text}</span>
      <span className="np-ghost-key">tab</span>
    </div>,
    document.body,
  );
}
