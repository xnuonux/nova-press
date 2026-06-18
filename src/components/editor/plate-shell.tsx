"use client";

/**
 * plate shell ... the editor canvas.
 *
 * plate v49, booted with basic blocks (headings, paragraph, blockquote,
 * divider) and basic marks (bold, italic, underline, strike, code). on top of
 * that spine: the bubble toolbar, emoji + slash menus, the cmd+k palette, and
 * nova's inline ghost text. rich blocks (image, code, table) are next.
 *
 * autosave persists to np_pieces via the savePieceContentAction server action,
 * debounced 1500ms. word count + excerpt are derived server-side.
 */

import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

import { BlurRisePlugin } from "./blur-rise";
import { BubbleToolbar } from "./bubble-toolbar";
import { CommandPalette } from "./command-palette";
import { EmojiPicker } from "./emoji-picker";
import { GhostText } from "./ghost-text";
import { NovaLinkPlugin } from "./link-block";
import { BulletItemPlugin, NumberItemPlugin } from "./list-blocks";
import { plateText } from "./plate-text";
import { PublishButton } from "./publish-button";
import { RepurposeLauncher } from "./repurpose-launcher";
import { SlashMenu } from "./slash-menu";
import { useAutosave } from "./use-autosave";

interface PlateShellProps {
  initialTitle: string;
  initialValue: Value;
  initialStatus: string;
  initialSlug: string | null;
  // a server action bound to this piece's id (page does the bind). taking
  // it as a prop keeps the shell decoupled from the action module ... it
  // just persists whatever it's handed.
  onSave: (input: { title: string; body: Value }) => Promise<void>;
  // publishes the piece and hands back the outcome (the public path, or a
  // reason it couldn't ship).
  onPublish: () => Promise<{ ok: true; slug: string; url: string } | { ok: false; error: string }>;
}

// the editor block set ... basic blocks + basic marks, plus nova's flat list
// items (ul_li / ol_li). lists carry their own render components so they paint
// in the editable; the reading view restitches the runs into real ul/ol.
const editorPlugins = [
  ParagraphPlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  BlockquotePlugin,
  HorizontalRulePlugin,
  BulletItemPlugin,
  NumberItemPlugin,
  NovaLinkPlugin,
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,
  BlurRisePlugin,
];

export function PlateShell({
  initialTitle,
  initialValue,
  initialStatus,
  initialSlug,
  onSave,
  onPublish,
}: PlateShellProps) {
  const [title, setTitle] = useState(initialTitle);
  const [wordCount, setWordCount] = useState(() => countWords(plateText(initialValue)));
  const [revision, setRevision] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);

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

  // flow detector: while the writer is actively editing, nova's partner rail
  // fades away ("it goes dark while you're talking") and returns on a pause. a
  // body class lets the rail (a sibling in the editor page) duck via css. this
  // is the "invisible until called" principle, made literal.
  const flowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markFlow = useCallback(() => {
    document.body.classList.add("np-flow");
    if (flowTimer.current) clearTimeout(flowTimer.current);
    flowTimer.current = setTimeout(() => document.body.classList.remove("np-flow"), 2500);
  }, []);
  useEffect(() => {
    return () => {
      document.body.classList.remove("np-flow");
      if (flowTimer.current) clearTimeout(flowTimer.current);
    };
  }, []);

  // plate fires onValueChange on caret moves too, not just edits. since every
  // re-render re-applies the dom selection (which plate then reports as another
  // change), reacting to a caret move would loop: bump revision -> re-render ->
  // selection re-applied -> onValueChange -> bump ... until react trips its
  // "maximum update depth" guard. the canonical slate test gates it: a caret
  // move carries only set_selection ops, a real edit carries at least one more.
  // bonus: autosave + the flow detector only react to real edits, never a caret
  // move.
  const handleValueChange = useCallback(() => {
    if (!editor.operations.some((op) => op.type !== "set_selection")) return;
    markFlow();
    setRevision((current) => current + 1);
    setWordCount(countWords(plateText(editor.children as Value)));
  }, [editor, markFlow]);

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

      // enter on an empty list item leaves the list (back to a paragraph)
      // instead of spawning another empty bullet ... the one classic list
      // reflex the flat ul_li / ol_li model would otherwise miss. a non-empty
      // item still splits into a fresh item of the same kind (slate's default).
      // the slash menu eats enter in capture phase while open, so this only ever
      // fires for a real line break.
      if (event.key === "Enter" && !event.shiftKey) {
        const blockIndex = editor.selection?.anchor.path[0];
        if (typeof blockIndex === "number") {
          const node = editor.children[blockIndex] as { type?: string } | undefined;
          const type = node?.type;
          if ((type === "ul_li" || type === "ol_li") && editor.api.string([blockIndex]) === "") {
            event.preventDefault();
            editor.tf.setNodes({ type: "p" }, { at: [blockIndex] });
            return;
          }
        }
      }

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

  // focus mode (cmd+. / ctrl+.) drops the chrome and dims everything but the
  // line you're on; typewriter mode (cmd+; / ctrl+;) keeps that line near the
  // middle of the screen. esc leaves either. a calm room to write in.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === ".") {
        event.preventDefault();
        setFocusMode((on) => !on);
      } else if (mod && event.key === ";") {
        event.preventDefault();
        setTypewriterMode((on) => !on);
      } else if (event.key === "Escape") {
        setFocusMode((on) => (on ? false : on));
        setTypewriterMode((on) => (on ? false : on));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // typewriter mode ... hold the caret line near the vertical middle of the
  // scroll surface so your eyes never chase the text down the page. scrolls
  // the editor's own scroller, only when the line actually moves.
  useEffect(() => {
    if (!typewriterMode) return;
    const center = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const scroller = document.querySelector(".np-scroll");
      if (!scroller) return;
      const caret = selection.getRangeAt(0).getBoundingClientRect();
      if (caret.top === 0 && caret.height === 0) return;
      const box = scroller.getBoundingClientRect();
      const delta = caret.top - (box.top + box.height * 0.42);
      if (Math.abs(delta) > 4) scroller.scrollBy({ top: delta, behavior: "smooth" });
    };
    center();
    document.addEventListener("selectionchange", center);
    return () => document.removeEventListener("selectionchange", center);
  }, [typewriterMode]);

  // focus mode also reaches outside this component ... a body class lets the
  // partner rail (a sibling in the editor page) fade away too.
  useEffect(() => {
    document.body.classList.toggle("np-focus-on", focusMode);
    return () => document.body.classList.remove("np-focus-on");
  }, [focusMode]);

  // while focused, tag the block holding the caret so css can lift it back to
  // full opacity. slate re-renders strip the attribute on a keystroke, but
  // selectionchange fires right after and re-tags ... fast enough to read as
  // steady.
  useEffect(() => {
    if (!focusMode) return;
    const tag = () => {
      const editable = document.querySelector('[data-slate-editor="true"]');
      if (!editable) return;
      const selection = window.getSelection();
      const node =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0).startContainer : null;
      for (const block of Array.from(editable.children)) {
        if (node && block.contains(node)) block.setAttribute("data-active-line", "true");
        else block.removeAttribute("data-active-line");
      }
    };
    tag();
    document.addEventListener("selectionchange", tag);
    return () => {
      document.removeEventListener("selectionchange", tag);
      document
        .querySelectorAll("[data-active-line]")
        .forEach((el) => el.removeAttribute("data-active-line"));
    };
  }, [focusMode]);

  const chromeStyle = {
    opacity: focusMode ? 0 : 1,
    pointerEvents: focusMode ? ("none" as const) : undefined,
    transition: "opacity 0.24s var(--ease-out-quart)",
  };

  // the editor subtree is memoized so the chrome's state (word count, saved
  // label, focus mode) never forces a re-render of <PlateContent>. plate's own
  // store drives the content; re-rendering the editable from the parent makes
  // slate reconcile the dom on every keystroke, and in react 19 that can
  // ping-pong onChange -> setState -> reconcile -> onChange into "maximum update
  // depth". all three deps are stable, so this builds once and stays put. it's
  // also just faster ... typing no longer re-renders the whole shell.
  const editorTree = useMemo(
    () => (
      <Plate editor={editor} onValueChange={handleValueChange}>
        <BubbleToolbar />
        <EmojiPicker />
        <SlashMenu />
        <CommandPalette />
        <GhostText />
        <PlateContent
          className="editor-body min-h-[55vh] outline-none"
          onKeyDown={handleEditorKeyDown}
          placeholder="start anywhere. nova is reading along."
          aria-label="piece body"
        />
      </Plate>
    ),
    [editor, handleValueChange, handleEditorKeyDown],
  );

  return (
    <div
      className={focusMode ? "np-focus flex h-full flex-1 flex-col" : "flex h-full flex-1 flex-col"}
    >
      <header className="flex items-center justify-end gap-4 px-8 py-3" style={chromeStyle}>
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

      <div className="np-scroll flex-1 overflow-y-auto">
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
            {editorTree}
          </div>
        </div>
      </div>

      <footer
        className="flex items-center justify-between border-t px-8 py-3 font-mono text-[11px] uppercase tracking-[0.2em]"
        style={{
          borderColor: "var(--lunari-border)",
          color: "var(--lunari-fg-subtle)",
          ...chromeStyle,
        }}
      >
        <span className="tabular-nums">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <PublishButton
          initialStatus={initialStatus}
          initialSlug={initialSlug}
          onPublish={onPublish}
        />
      </footer>

      {focusMode || typewriterMode ? (
        <div className="np-focus-hint" aria-hidden>
          {[focusMode ? "focus" : null, typewriterMode ? "typewriter" : null]
            .filter(Boolean)
            .join(" + ")}{" "}
          ... esc to leave
        </div>
      ) : null}
    </div>
  );
}
