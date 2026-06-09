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

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

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

  const sync = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setAnchor(null);
      return;
    }

    // only fire inside the editor body, never on chrome / title / rail.
    const editable = document.querySelector('[data-slate-editor="true"]');
    const range = selection.getRangeAt(0);
    if (!editable || !editable.contains(range.commonAncestorContainer)) {
      setAnchor(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setAnchor(null);
      return;
    }

    setAnchor({ top: rect.top, left: rect.left + rect.width / 2 });
    const marks = editor.api.marks() as Record<string, unknown> | null;
    setActive(Object.fromEntries(MARKS.map((m) => [m.key, !!marks?.[m.key]])));
  }, [editor]);

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
    </div>,
    document.body,
  );
}
