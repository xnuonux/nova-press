"use client";

/**
 * command palette ... cmd+k (ctrl+k) opens a searchable command space over the
 * editor. type to filter, arrow to move, enter to run, esc to close. formatting
 * marks + block types in one keyboard-first surface, so you never reach for the
 * toolbar. slate keeps editor.selection alive while the search input holds dom
 * focus, so a mark/block applies to whatever you had selected.
 *
 * same lunari surface + planetarium grow-in as the rest. lowercase labels, a
 * quiet mono hint on the right, golden active row.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useEditorRef } from "platejs/react";

type Run =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "code"
  | "h1"
  | "h2"
  | "h3"
  | "blockquote"
  | "divider";

interface Command {
  key: Run;
  label: string;
  hint: string;
  words: string[];
}

const COMMANDS: Command[] = [
  { key: "bold", label: "bold", hint: "cmd b", words: ["bold", "strong"] },
  { key: "italic", label: "italic", hint: "cmd i", words: ["italic", "emphasis"] },
  { key: "underline", label: "underline", hint: "cmd u", words: ["underline"] },
  {
    key: "strikethrough",
    label: "strikethrough",
    hint: "strike",
    words: ["strike", "strikethrough"],
  },
  { key: "code", label: "inline code", hint: "mono", words: ["code", "mono"] },
  { key: "h1", label: "heading 1", hint: "block", words: ["heading", "title", "h1"] },
  { key: "h2", label: "heading 2", hint: "block", words: ["heading", "h2", "section"] },
  { key: "h3", label: "heading 3", hint: "block", words: ["heading", "h3"] },
  { key: "blockquote", label: "quote", hint: "block", words: ["quote", "blockquote", "cite"] },
  { key: "divider", label: "divider", hint: "block", words: ["divider", "hr", "rule", "line"] },
];

const MARKS = new Set<Run>(["bold", "italic", "underline", "strikethrough", "code"]);

function filterCommands(query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMMANDS;
  return COMMANDS.filter(
    (c) => c.label.replace(/\s/g, "").includes(q) || c.words.some((w) => w.includes(q)),
  );
}

export function CommandPalette() {
  const editor = useEditorRef();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => filterCommands(query), [query]);

  // cmd+k / ctrl+k toggles the palette from anywhere in the editor.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setIndex(0);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setIndex((i) => (i < results.length ? i : 0));
  }, [results.length]);

  const run = useCallback(
    (command: Command) => {
      setOpen(false);
      try {
        if (MARKS.has(command.key)) {
          editor.tf.toggleMark(command.key);
        } else if (command.key === "divider") {
          editor.tf.insertNodes({ type: "hr", children: [{ text: "" }] });
          editor.tf.insertNodes({ type: "p", children: [{ text: "" }] }, { select: true });
        } else {
          editor.tf.toggleBlock(command.key);
        }
        editor.tf.focus();
      } catch {
        // api mismatch ... fail closed
      }
    },
    [editor],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[18vh] sm:p-8 sm:pt-[18vh]"
      style={{ background: "var(--lunari-overlay-light)", backdropFilter: "blur(5px)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        className="np-cmdk w-full max-w-md overflow-hidden rounded-2xl"
        style={{
          background: "var(--lunari-bg-elevated)",
          border: "1px solid var(--lunari-border)",
          boxShadow: "0 40px 120px -40px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.04)",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="a command ..."
          aria-label="command palette"
          className="w-full bg-transparent px-5 py-4 font-serif text-lg outline-none"
          style={{
            color: "var(--lunari-fg-primary)",
            borderBottom: "1px solid var(--lunari-border)",
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((i) => (results.length ? (i + 1) % results.length : 0));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const chosen = results[index];
              if (chosen) run(chosen);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
        />
        <div className="max-h-[44vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-4 font-serif text-sm" style={{ color: "var(--lunari-fg-muted)" }}>
              nothing matches.
            </p>
          ) : (
            results.map((command, i) => (
              <button
                key={command.key}
                type="button"
                role="option"
                aria-selected={i === index}
                data-active={i === index ? "true" : "false"}
                className="np-cmdk-row flex w-full items-baseline justify-between gap-4 rounded-lg px-3 py-2.5 text-left"
                onMouseEnter={() => setIndex(i)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  run(command);
                }}
              >
                <span className="np-cmdk-label">{command.label}</span>
                <span className="np-cmdk-hint">{command.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
