"use client";

/**
 * plate shell ... the editor canvas.
 *
 * plate v49, booted with basic blocks (headings, paragraph, blockquote,
 * divider) and basic marks (bold, italic, underline, strike, code). nothing
 * else yet ... AIKit, SlashKit, CopilotKit, the bubble toolbar and ghost text
 * are week 2.
 *
 * autosave is local-state only for now. T-012 wires it to POST /api/revisions.
 */

import { type ChangeEvent, useCallback, useMemo, useState } from "react";

import {
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  HorizontalRulePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import type { Value } from "platejs";
import {
  ParagraphPlugin,
  Plate,
  PlateContent,
  usePlateEditor,
} from "platejs/react";

import { countWords } from "@/lib/utils";

import { plateText } from "./plate-text";
import { useAutosave } from "./use-autosave";

interface PlateShellProps {
  initialTitle?: string;
}

const initialValue: Value = [{ type: "p", children: [{ text: "" }] }];

// week 1 plugin set ... basic blocks + basic marks, and nothing else.
const editorPlugins = [
  ParagraphPlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  BlockquotePlugin,
  HorizontalRulePlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,
];

export function PlateShell({ initialTitle = "untitled" }: PlateShellProps) {
  const [title, setTitle] = useState(initialTitle);
  const [wordCount, setWordCount] = useState(0);
  const [revision, setRevision] = useState(0);

  const editor = usePlateEditor({
    plugins: editorPlugins,
    value: initialValue,
  });

  // autosave watches the title and a body revision counter
  const { savedLabel } = useAutosave(
    useMemo(() => ({ title, revision }), [title, revision]),
  );

  const handleValueChange = useCallback(() => {
    setRevision((current) => current + 1);
    setWordCount(countWords(plateText(editor.children)));
  }, [editor]);

  const handleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value),
    [],
  );

  return (
    <div className="flex h-full flex-1 flex-col">
      <header
        className="flex items-center justify-between border-b px-8 py-4"
        style={{ borderColor: "var(--lunari-border)" }}
      >
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          aria-label="piece title"
          className="bg-transparent font-serif text-lg outline-none"
          style={{ color: "var(--lunari-fg-primary)" }}
        />
        <span
          className="font-sans text-xs tabular-nums"
          style={{ color: "var(--lunari-fg-muted)" }}
        >
          {savedLabel}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="editor-canvas">
          <Plate editor={editor} onValueChange={handleValueChange}>
            <PlateContent
              className="min-h-[60vh] outline-none"
              placeholder="start anywhere. nova is reading along."
              aria-label="piece body"
            />
          </Plate>
        </div>
      </div>

      <footer
        className="flex items-center justify-between border-t px-8 py-3 font-sans text-xs"
        style={{
          borderColor: "var(--lunari-border)",
          color: "var(--lunari-fg-muted)",
        }}
      >
        <span className="tabular-nums">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <span
          className="font-mono uppercase tracking-[0.22em]"
          style={{ color: "var(--lunari-fg-subtle)" }}
        >
          draft
        </span>
      </footer>
    </div>
  );
}
