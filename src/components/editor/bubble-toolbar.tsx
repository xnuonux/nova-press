"use client";

/**
 * bubble toolbar ... the classic float-on-selection mark bar.
 *
 * appears above any non-collapsed selection inside the editor body, toggles
 * the basic marks (bold / italic / underline / strike / code), warms to the
 * golden accent when a mark is live. positioned off the dom selection rect so
 * it rides scroll and reflow without leaning on plate internals.
 *
 * week 2 grafts the AI actions (improve / shorten / rewrite / voice-check)
 * onto the right of this same bar.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { upsertLink } from "@platejs/link";
import { Link2 } from "lucide-react";
import { useEditorRef } from "platejs/react";

const MARKS = [
  { key: "bold", glyph: "B", title: "bold", glyphClass: "font-semibold" },
  { key: "italic", glyph: "I", title: "italic", glyphClass: "italic font-serif" },
  { key: "underline", glyph: "U", title: "underline", glyphClass: "underline" },
  { key: "strikethrough", glyph: "S", title: "strikethrough", glyphClass: "line-through" },
  { key: "code", glyph: "</>", title: "code", glyphClass: "font-mono text-[11px]" },
] as const;

interface Anchor {
  top: number;
  left: number;
}

export function BubbleToolbar() {
  const editor = useEditorRef();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  // last value we pushed to state. sync runs on every selectionchange + scroll,
  // and slate re-applies the dom selection on each editor re-render, which
  // fires selectionchange again ... so a fresh-object setState here would feed
  // a render loop. we only setState when the computed value actually changed.
  const lastSig = useRef("null");

  const sync = useCallback(() => {
    const clear = () => {
      if (lastSig.current !== "null") {
        lastSig.current = "null";
        setAnchor(null);
      }
    };

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return clear();

    // only fire inside the editor body, never on chrome / title / rail.
    const editable = document.querySelector('[data-slate-editor="true"]');
    const range = selection.getRangeAt(0);
    if (!editable || !editable.contains(range.commonAncestorContainer)) return clear();

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return clear();

    const top = Math.round(rect.top);
    const left = Math.round(rect.left + rect.width / 2);
    const marks = editor.api.marks() as Record<string, unknown> | null;
    const activeMap = Object.fromEntries(MARKS.map((m) => [m.key, !!marks?.[m.key]]));
    const sig = `${top}|${left}|${MARKS.map((m) => (activeMap[m.key] ? "1" : "0")).join("")}`;
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    setAnchor({ top, left });
    setActive(activeMap);
  }, [editor]);

  // the link button reuses the mark buttons' selection trick: mousedown +
  // preventDefault keeps the editable from blurring on the click, and we grab
  // the slate range before window.prompt steals focus, then restore it so
  // upsertLink wraps the exact text the writer selected. @platejs/link's own
  // validateUrl drops a hostile scheme on the way in; the reading view
  // sanitizes again on the way out.
  const onLink = useCallback(() => {
    const saved = editor.selection;
    if (!saved) return;
    const input = window.prompt("link url");
    const url = input === null ? "" : input.trim();
    // restore focus + the captured range no matter what, then upsert if a url
    // was given. wrapped fail-closed (same as the slash menu): if the range
    // went stale while the prompt was open, leave the body untouched rather
    // than throw out of the click handler.
    try {
      editor.tf.focus();
      editor.tf.select(saved);
      if (url !== "") upsertLink(editor, { url });
    } catch {
      // selection/transform mismatch ... fail closed
    }
    sync();
  }, [editor, sync]);

  useEffect(() => {
    document.addEventListener("selectionchange", sync);
    // capture-phase scroll so an inner scroll container still repositions us.
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      document.removeEventListener("selectionchange", sync);
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  if (!anchor) return null;

  return createPortal(
    <div
      role="toolbar"
      aria-label="formatting"
      className="np-bubble"
      style={{ top: anchor.top, left: anchor.left }}
    >
      {MARKS.map((mark) => (
        <button
          key={mark.key}
          type="button"
          title={mark.title}
          aria-label={mark.title}
          aria-pressed={active[mark.key] ?? false}
          data-active={active[mark.key] ? "true" : "false"}
          // mousedown + preventDefault keeps the editor selection alive through
          // the click ... onClick would blur the editable and drop the range.
          onMouseDown={(event) => {
            event.preventDefault();
            editor.tf.toggleMark(mark.key);
            sync();
          }}
        >
          <span className={mark.glyphClass}>{mark.glyph}</span>
        </button>
      ))}
      <span className="np-bubble-divider" aria-hidden />
      <button
        type="button"
        title="link"
        aria-label="link"
        // same selection-preserving trick as the marks: never blur the editable.
        onMouseDown={(event) => {
          event.preventDefault();
          onLink();
        }}
      >
        <Link2 size={15} strokeWidth={2} aria-hidden />
      </button>
    </div>,
    document.body,
  );
}
