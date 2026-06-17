"use client";

/**
 * slash menu ... type "/" at a line start (or after a space) and a small
 * floating list of block commands appears: heading 1-3, quote, divider.
 *
 * same shape as the emoji picker (portal, caret-leaf trigger detection,
 * capture-phase keyboard nav) so the two feel like one family. selecting a
 * command strips the "/query" run and transforms the block (toggleBlock) or
 * drops a divider (insertNodes). lowercase labels, golden active row, the
 * planetarium grow-in. no new deps ... the block plugins are already loaded.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useEditorRef } from "platejs/react";

interface Command {
  key: string;
  label: string;
  hint: string;
  words: string[];
}

const COMMANDS: Command[] = [
  { key: "h1", label: "heading 1", hint: "large title", words: ["heading", "title", "h1", "big"] },
  { key: "h2", label: "heading 2", hint: "section", words: ["heading", "h2", "section"] },
  { key: "h3", label: "heading 3", hint: "subsection", words: ["heading", "h3", "subsection"] },
  {
    key: "blockquote",
    label: "quote",
    hint: "set it apart",
    words: ["quote", "blockquote", "cite"],
  },
  {
    key: "divider",
    label: "divider",
    hint: "a line between",
    words: ["divider", "hr", "rule", "line", "break"],
  },
];

function filterCommands(query: string): Command[] {
  if (!query) return COMMANDS;
  const q = query.toLowerCase();
  return COMMANDS.filter(
    (c) =>
      c.key.startsWith(q) ||
      c.label.replace(/\s/g, "").includes(q) ||
      c.words.some((w) => w.startsWith(q)),
  );
}

interface Trigger {
  path: number[];
  slashOffset: number;
  caretOffset: number;
}

interface PopState {
  results: Command[];
  index: number;
  top: number;
  left: number;
}

export function SlashMenu() {
  const editor = useEditorRef();
  const [pop, setPop] = useState<PopState | null>(null);
  const triggerRef = useRef<Trigger | null>(null);

  const detect = useCallback(() => {
    const domSel = window.getSelection();
    if (!domSel || !domSel.isCollapsed || domSel.rangeCount === 0) {
      triggerRef.current = null;
      setPop(null);
      return;
    }
    const selection = editor.selection;
    if (!selection) {
      triggerRef.current = null;
      setPop(null);
      return;
    }

    const path = selection.anchor.path;
    const caretOffset = selection.anchor.offset;
    let before = "";
    try {
      before = editor.api.string({ anchor: { path, offset: 0 }, focus: selection.anchor });
    } catch {
      triggerRef.current = null;
      setPop(null);
      return;
    }

    // "/" at block start or after whitespace, then an optional command query.
    // mid-word slashes (and/or) don't match ... there's no start/space before.
    const match = before.match(/(?:^|\s)(\/)([a-zA-Z0-9]*)$/);
    if (!match) {
      triggerRef.current = null;
      setPop(null);
      return;
    }

    const query = match[2] ?? "";
    const results = filterCommands(query);
    if (results.length === 0) {
      triggerRef.current = null;
      setPop(null);
      return;
    }

    const rect = domSel.getRangeAt(0).getBoundingClientRect();
    triggerRef.current = { path, slashOffset: caretOffset - query.length - 1, caretOffset };
    setPop((prev) => ({
      results,
      index: prev && prev.index < results.length ? prev.index : 0,
      top: rect.bottom + 6,
      left: rect.left,
    }));
  }, [editor]);

  const run = useCallback(
    (command: Command) => {
      const trig = triggerRef.current;
      triggerRef.current = null;
      setPop(null);
      if (!trig) return;
      const range = {
        anchor: { path: trig.path, offset: trig.slashOffset },
        focus: { path: trig.path, offset: trig.caretOffset },
      };
      try {
        editor.tf.delete({ at: range });
        if (command.key === "divider") {
          editor.tf.insertNodes({ type: "hr", children: [{ text: "" }] });
          editor.tf.insertNodes({ type: "p", children: [{ text: "" }] }, { select: true });
        } else {
          editor.tf.toggleBlock(command.key);
        }
        editor.tf.focus();
      } catch {
        // transform api mismatch ... fail closed, leave the text be
      }
    },
    [editor],
  );

  useEffect(() => {
    document.addEventListener("selectionchange", detect);
    window.addEventListener("scroll", detect, true);
    window.addEventListener("resize", detect);
    return () => {
      document.removeEventListener("selectionchange", detect);
      window.removeEventListener("scroll", detect, true);
      window.removeEventListener("resize", detect);
    };
  }, [detect]);

  useEffect(() => {
    if (!pop) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setPop((p) => (p ? { ...p, index: (p.index + 1) % p.results.length } : p));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setPop((p) =>
          p ? { ...p, index: (p.index - 1 + p.results.length) % p.results.length } : p,
        );
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        const chosen = pop.results[pop.index];
        if (chosen) run(chosen);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        triggerRef.current = null;
        setPop(null);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [pop, run]);

  if (!pop) return null;

  return createPortal(
    <div
      className="np-slash"
      style={{ top: pop.top, left: pop.left }}
      role="listbox"
      aria-label="block commands"
    >
      {pop.results.map((command, i) => (
        <button
          key={command.key}
          type="button"
          role="option"
          aria-selected={i === pop.index}
          data-active={i === pop.index ? "true" : "false"}
          onMouseDown={(event) => {
            event.preventDefault();
            run(command);
          }}
          onMouseEnter={() => setPop((p) => (p ? { ...p, index: i } : p))}
        >
          <span className="np-slash-label">{command.label}</span>
          <span className="np-slash-hint">{command.hint}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
