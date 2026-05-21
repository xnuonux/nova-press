"use client";

/**
 * plate shell ... the editor canvas client component.
 *
 * week 1: minimal plate boot with BasicBlocksKit + BasicMarksKit. autosave
 * chip is local-state only (no supabase write yet).
 * week 1 later (T-012): autosave hits POST /api/revisions.
 * week 2: AIKit, SlashKit, CopilotKit, bubble toolbar, ghost text.
 *
 * NOTE: plate's API surface changes between minor versions. if the import
 * paths below break on your installed version, run `pnpm why @udecode/plate`
 * to see what landed and adjust. claude code should read the plate-editor
 * skill before touching this file.
 */

import { useState, useEffect, useCallback, useMemo } from "react";

interface PlateShellProps {
  initialTitle?: string;
}

type AutosaveState = "idle" | "saving" | "saved";

export function PlateShell({ initialTitle = "untitled" }: PlateShellProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState("");
  const [autosave, setAutosave] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // autosave stub: 1500ms debounce → marks saved.
  // real version hits POST /api/revisions and writes a row.
  useEffect(() => {
    if (!body && !title) return;
    setAutosave("saving");
    const timer = setTimeout(() => {
      setAutosave("saved");
      setLastSavedAt(Date.now());
    }, 1500);
    return () => clearTimeout(timer);
  }, [body, title]);

  // tick once a second to refresh the "saved Xs ago" label
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const savedLabel = useMemo(() => {
    if (autosave === "saving") return "saving...";
    if (autosave === "idle" || !lastSavedAt) return "ready";
    const seconds = Math.max(0, Math.floor((now - lastSavedAt) / 1000));
    if (seconds < 5) return "saved just now";
    if (seconds < 60) return `saved ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `saved ${minutes}m ago`;
  }, [autosave, lastSavedAt, now]);

  const wordCount = useMemo(() => {
    return body.trim() ? body.trim().split(/\s+/).length : 0;
  }, [body]);

  const onTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);

  const onBodyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
  }, []);

  return (
    <div className="flex h-full flex-1 flex-col">
      <header
        className="flex items-center justify-between border-b px-8 py-4"
        style={{ borderColor: "var(--lunari-border)" }}
      >
        <input
          type="text"
          value={title}
          onChange={onTitleChange}
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

      <div className="editor-canvas flex-1">
        <textarea
          value={body}
          onChange={onBodyChange}
          placeholder="start anywhere. nova is reading along."
          aria-label="piece body"
          className="block w-full resize-none bg-transparent font-serif outline-none"
          style={{
            color: "var(--lunari-fg-primary)",
            fontSize: 18,
            lineHeight: 1.75,
            minHeight: "60vh",
          }}
        />
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
        <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
          plate boots in week 1 (T-011) ... textarea stub for now
        </span>
      </footer>
    </div>
  );
}
