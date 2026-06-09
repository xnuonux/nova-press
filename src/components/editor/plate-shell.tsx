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

import { type ChangeEvent, type KeyboardEvent, useCallback, useMemo, useState } from "react";

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

import { BubbleToolbar } from "./bubble-toolbar";
import { EmojiPicker } from "./emoji-picker";
import { plateText } from "./plate-text";
import { RepurposeLauncher } from "./repurpose-launcher";
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

  // the single character immediately before a collapsed caret ... "" when
  // there's nothing there or the api shape surprises us. drives smart-quote
  // direction (open vs close).
  const charBeforeCaret = useCallback((): string => {
    const { selection } = editor;
    if (!selection) return "";
    try {
      const before = editor.api.before(selection.anchor, { unit: "character" });
      if (!before) return "";
      return editor.api.string({ anchor: before, focus: selection.anchor });
    } catch {
      return "";
    }
  }, [editor]);

  // the classics. tab makes a real indent like the good old days; shift+tab
  // peels one back. straight quotes become curly, direction from the
  // preceding char. there is deliberately NO em-dash autoformat here ... the
  // voice rule forbids em-dashes, so -- stays -- and pauses stay "...".
  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.nativeEvent.isComposing) return;

      if (event.key === "Tab") {
        event.preventDefault();
        if (!event.shiftKey) {
          editor.tf.insertText("\t");
          return;
        }
        const { selection } = editor;
        if (!selection) return;
        try {
          const before = editor.api.before(selection.anchor, { unit: "character" });
          if (!before) return;
          const range = { anchor: before, focus: selection.anchor };
          if (editor.api.string(range) === "\t") editor.tf.delete({ at: range });
        } catch {
          // api mismatch ... fail closed, leave the indent be
        }
        return;
      }

      if (
        (event.key === '"' || event.key === "'") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        const prev = charBeforeCaret();
        const opens = prev === "" || /[\s(\[{“‘]/.test(prev);
        const quote = event.key === '"' ? (opens ? "“" : "”") : opens ? "‘" : "’";
        editor.tf.insertText(quote);
      }
    },
    [editor, charBeforeCaret],
  );

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex items-center justify-end gap-4 px-8 py-3">
        <RepurposeLauncher
          getSource={() => ({ title, source: plateText(editor.children as Value) })}
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
          <div className="editor-sheet">
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              aria-label="piece title"
              placeholder="untitled"
              className="editor-title"
            />
            <Plate editor={editor} onValueChange={handleValueChange}>
              <BubbleToolbar />
              <EmojiPicker />
              <PlateContent
                className="editor-body min-h-[55vh] outline-none"
                onKeyDown={handleEditorKeyDown}
                placeholder="start anywhere. nova is reading along."
                aria-label="piece body"
              />
            </Plate>
          </div>
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
