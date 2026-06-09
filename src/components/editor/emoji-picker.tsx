"use client";

/**
 * emoji picker ... type ":" then a word, pick from a small floating list.
 *
 * deliberately lightweight: no npm emoji dep (this machine OOMs on installs),
 * just a curated set with keywords. trigger is detected off the caret leaf
 * text, the popup floats at the caret rect, arrow/enter/tab/esc navigate, and
 * selecting replaces the ":query" run with the glyph. kept minimal to match
 * the editor ... a quiet helper, not a toy.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useEditorRef } from "platejs/react";

interface Emoji {
  glyph: string;
  name: string;
  keywords: string[];
}

// curated, not exhaustive. common needs + a little golden-hour warmth.
const EMOJI: Emoji[] = [
  { glyph: "😀", name: "smile", keywords: ["happy", "grin", "joy"] },
  { glyph: "😂", name: "joy", keywords: ["laugh", "lol", "tears"] },
  { glyph: "🙂", name: "slight_smile", keywords: ["smile", "soft"] },
  { glyph: "😉", name: "wink", keywords: ["flirt", "playful"] },
  { glyph: "😍", name: "heart_eyes", keywords: ["love", "adore"] },
  { glyph: "🥹", name: "holding_back_tears", keywords: ["moved", "grateful", "proud"] },
  { glyph: "😅", name: "sweat_smile", keywords: ["nervous", "phew"] },
  { glyph: "😭", name: "sob", keywords: ["cry", "weep", "tears"] },
  { glyph: "😤", name: "triumph", keywords: ["determined", "proud"] },
  { glyph: "🤔", name: "thinking", keywords: ["hmm", "consider", "ponder"] },
  { glyph: "🫠", name: "melting", keywords: ["overwhelmed", "hot", "dissolve"] },
  { glyph: "😌", name: "relieved", keywords: ["calm", "content", "peace"] },
  { glyph: "🥲", name: "smiling_tear", keywords: ["bittersweet", "touched"] },
  { glyph: "😏", name: "smirk", keywords: ["sly", "knowing"] },
  { glyph: "🙃", name: "upside_down", keywords: ["irony", "silly"] },
  { glyph: "😶‍🌫️", name: "in_clouds", keywords: ["foggy", "lost", "dazed"] },
  { glyph: "🫶", name: "heart_hands", keywords: ["love", "gratitude", "care"] },
  { glyph: "🙏", name: "pray", keywords: ["thanks", "please", "hope"] },
  { glyph: "👀", name: "eyes", keywords: ["look", "watch", "attention"] },
  { glyph: "👏", name: "clap", keywords: ["applause", "bravo"] },
  { glyph: "🤌", name: "pinched", keywords: ["chefs", "perfect", "italian"] },
  { glyph: "💪", name: "muscle", keywords: ["strong", "power"] },
  { glyph: "✍️", name: "writing", keywords: ["write", "pen", "draft"] },
  { glyph: "🖊️", name: "pen", keywords: ["write", "ink"] },
  { glyph: "📝", name: "memo", keywords: ["note", "write", "edit"] },
  { glyph: "📖", name: "book", keywords: ["read", "story", "open"] },
  { glyph: "📚", name: "books", keywords: ["read", "library", "study"] },
  { glyph: "💡", name: "bulb", keywords: ["idea", "insight", "light"] },
  { glyph: "🔥", name: "fire", keywords: ["hot", "lit", "flame"] },
  { glyph: "✨", name: "sparkles", keywords: ["magic", "shine", "new", "muse"] },
  { glyph: "🌟", name: "star2", keywords: ["glow", "shine", "special"] },
  { glyph: "⭐", name: "star", keywords: ["favorite", "rate"] },
  { glyph: "🌅", name: "sunrise", keywords: ["dawn", "golden", "morning", "hour"] },
  { glyph: "🌇", name: "sunset", keywords: ["dusk", "golden", "evening", "hour"] },
  { glyph: "🌙", name: "moon", keywords: ["night", "crescent", "late"] },
  { glyph: "☀️", name: "sun", keywords: ["light", "day", "bright"] },
  { glyph: "🌊", name: "wave", keywords: ["ocean", "flow", "sea"] },
  { glyph: "🌿", name: "herb", keywords: ["green", "calm", "nature"] },
  { glyph: "🍂", name: "leaves", keywords: ["autumn", "fall", "warm"] },
  { glyph: "☕", name: "coffee", keywords: ["cafe", "morning", "write"] },
  { glyph: "🕯️", name: "candle", keywords: ["warm", "quiet", "light"] },
  { glyph: "🎬", name: "clapper", keywords: ["film", "scene", "action"] },
  { glyph: "🎧", name: "headphones", keywords: ["music", "listen", "focus"] },
  { glyph: "❤️", name: "heart", keywords: ["love", "red"] },
  { glyph: "🧡", name: "orange_heart", keywords: ["love", "warm", "golden"] },
  { glyph: "💛", name: "yellow_heart", keywords: ["love", "gold", "joy"] },
  { glyph: "🤍", name: "white_heart", keywords: ["love", "pure"] },
  { glyph: "💔", name: "broken_heart", keywords: ["hurt", "sad", "loss"] },
  { glyph: "🩵", name: "light_blue_heart", keywords: ["love", "calm"] },
  { glyph: "✅", name: "check", keywords: ["done", "yes", "correct"] },
  { glyph: "❌", name: "cross", keywords: ["no", "wrong", "stop"] },
  { glyph: "⚡", name: "zap", keywords: ["fast", "energy", "bolt"] },
  { glyph: "🎯", name: "target", keywords: ["goal", "aim", "focus"] },
  { glyph: "🚀", name: "rocket", keywords: ["launch", "ship", "fast"] },
  { glyph: "🧠", name: "brain", keywords: ["think", "smart", "mind"] },
  { glyph: "👋", name: "wave_hand", keywords: ["hi", "hello", "bye"] },
  { glyph: "🤷", name: "shrug", keywords: ["dunno", "whatever"] },
  { glyph: "💬", name: "speech", keywords: ["talk", "comment", "say"] },
  { glyph: "📌", name: "pin", keywords: ["important", "mark"] },
  { glyph: "🔖", name: "bookmark", keywords: ["save", "tag"] },
  { glyph: "🪄", name: "wand", keywords: ["magic", "muse", "spell"] },
  { glyph: "🌌", name: "milky_way", keywords: ["stars", "night", "cosmos", "lunari"] },
];

const MAX_RESULTS = 7;

interface Trigger {
  path: number[];
  colonOffset: number;
  caretOffset: number;
}

interface PopState {
  results: Emoji[];
  index: number;
  top: number;
  left: number;
}

function filterEmoji(query: string): Emoji[] {
  if (!query) return EMOJI.slice(0, MAX_RESULTS);
  const q = query.toLowerCase();
  const scored = EMOJI.map((e) => {
    const hay = [e.name, ...e.keywords];
    let score = -1;
    for (const term of hay) {
      if (term === q) score = Math.max(score, 3);
      else if (term.startsWith(q)) score = Math.max(score, 2);
      else if (term.includes(q)) score = Math.max(score, 1);
    }
    return { e, score };
  }).filter((s) => s.score >= 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_RESULTS).map((s) => s.e);
}

export function EmojiPicker() {
  const editor = useEditorRef();
  const [pop, setPop] = useState<PopState | null>(null);
  const triggerRef = useRef<Trigger | null>(null);

  // detect ":query" right behind a collapsed caret, off the leaf text.
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
      before = editor.api.string({
        anchor: { path, offset: 0 },
        focus: selection.anchor,
      });
    } catch {
      triggerRef.current = null;
      setPop(null);
      return;
    }

    const match = before.match(/(?:^|\s)(:)([a-zA-Z0-9_+-]*)$/);
    if (!match) {
      triggerRef.current = null;
      setPop(null);
      return;
    }

    const query = match[2] ?? "";
    const results = filterEmoji(query);
    if (results.length === 0) {
      triggerRef.current = null;
      setPop(null);
      return;
    }

    const rect = domSel.getRangeAt(0).getBoundingClientRect();
    triggerRef.current = {
      path,
      colonOffset: caretOffset - query.length - 1,
      caretOffset,
    };
    setPop((prev) => ({
      results,
      // keep the highlight if it's still in range, else reset to top.
      index: prev && prev.index < results.length ? prev.index : 0,
      top: rect.bottom + 6,
      left: rect.left,
    }));
  }, [editor]);

  const insert = useCallback(
    (emoji: string) => {
      const trig = triggerRef.current;
      triggerRef.current = null;
      setPop(null);
      if (!trig) return;
      const range = {
        anchor: { path: trig.path, offset: trig.colonOffset },
        focus: { path: trig.path, offset: trig.caretOffset },
      };
      try {
        editor.tf.delete({ at: range });
        editor.tf.insertText(emoji);
      } catch {
        // path drifted out from under us ... just bail, no insert
      }
    },
    [editor],
  );

  // trigger detection rides selectionchange (fires on every keystroke + caret
  // move). scroll/resize reposition.
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

  // keyboard nav, capture phase so it beats slate's own editable handler ...
  // enter/tab insert instead of breaking the line, esc dismisses.
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
        if (chosen) insert(chosen.glyph);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        triggerRef.current = null;
        setPop(null);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [pop, insert]);

  if (!pop) return null;

  return createPortal(
    <div
      className="np-emoji"
      style={{ top: pop.top, left: pop.left }}
      role="listbox"
      aria-label="emoji"
    >
      {pop.results.map((emoji, i) => (
        <button
          key={emoji.glyph}
          type="button"
          role="option"
          aria-selected={i === pop.index}
          data-active={i === pop.index ? "true" : "false"}
          onMouseDown={(event) => {
            event.preventDefault();
            insert(emoji.glyph);
          }}
          onMouseEnter={() => setPop((p) => (p ? { ...p, index: i } : p))}
        >
          <span className="np-emoji-glyph">{emoji.glyph}</span>
          <span className="np-emoji-name">{emoji.name.replace(/_/g, " ")}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
