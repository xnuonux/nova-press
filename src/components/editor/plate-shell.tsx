"use client";

/**
 * plate shell ... the editor canvas.
 *
 * plate v49, booted with basic blocks (headings, paragraph, blockquote,
 * divider) and basic marks (bold, italic, underline, strike, code). nothing
 * else yet ... AIKit, SlashKit, CopilotKit, the bubble toolbar and ghost text
 * are week 2.
 *
 * autosave persists to np_pieces via the savePieceContentAction server action,
 * debounced 1500ms. word count + excerpt are derived server-side.
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
import { ParagraphPlugin, Plate, PlateContent, usePlateEditor } from "platejs/react";

import { countWords } from "@/lib/utils";

import { plateText } from "./plate-text";
import { useAutosave } from "./use-autosave";

interface PlateShellProps {
  initialTitle: string;
  initialValue: Value;
  initialStatus: string;
  // a server action bound to this piece's id (page does the bind). taking
  // it as a prop keeps the shell decoupled from the action module ... it
  // just persists whatever it's handed.
  onSave: (input: { title: string; body: Value }) => Promise<void>;
}

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

export function PlateShell({ initialTitle, initialValue, initialStatus, onSave }: PlateShellProps) {
  const [title, setTitle] = useState(initialTitle);
  const [wordCount, setWordCount] = useState(() => countWords(plateText(initialValue)));
  const [revision, setRevision] = useState(0);

  const editor = usePlateEditor({
    plugins: editorPlugins,
    value: initialValue,
  });

  // onSave reads the live document + title at fire time, so we never mirror
  // the whole value into react state on every keystroke.
  const handleSave = useCallback(
    () => onSave({ title, body: editor.children as Value }),
    [onSave, title, editor],
  );

  const { savedLabel } = useAutosave({
    trigger: useMemo(() => ({ title, revision }), [title, revision]),
    onSave: handleSave,
  });

  const handleValueChange = useCallback(() => {
    setRevision((current) => current + 1);
    setWordCount(countWords(plateText(editor.children as Value)));
  }, [editor]);

  const handleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value),
    [],
  );

  return (
    <div className="flex h-full flex-1 flex-col">
      <header
        className="flex items-center justify-between gap-4 border-b px-8 py-4"
        style={{ borderColor: "var(--lunari-border)" }}
      >
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          aria-label="piece title"
          placeholder="untitled"
          className="min-w-0 flex-1 bg-transparent font-serif text-xl tracking-tight outline-none"
          style={{ color: "var(--lunari-fg-primary)" }}
        />
        <span
          className="shrink-0 font-mono text-[11px] uppercase tabular-nums tracking-[0.2em]"
          style={{ color: "var(--lunari-fg-subtle)" }}
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
        className="flex items-center justify-between border-t px-8 py-3 font-mono text-[11px] uppercase tracking-[0.2em]"
        style={{
          borderColor: "var(--lunari-border)",
          color: "var(--lunari-fg-subtle)",
        }}
      >
        <span className="tabular-nums">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <span
          className="rounded-full px-2.5 py-1"
          style={
            initialStatus === "published" || initialStatus === "scheduled"
              ? {
                  background: "var(--nova-accent-soft)",
                  color: "var(--nova-accent)",
                }
              : {
                  border: "1px solid var(--lunari-border)",
                  color: "var(--lunari-fg-subtle)",
                }
          }
        >
          {initialStatus}
        </span>
      </footer>
    </div>
  );
}
