"use client";

import { useCallback } from "react";
import { useEditorRef } from "platejs/react";
import { captureDraft, type Draft, type TextRange } from "@/lib/editor/manuscript-desk";
import { ManuscriptDeskView } from "./manuscript-desk-view";

/** a small plate bridge ... source reads and selection only, no document writes. */
export function ManuscriptDesk({ pieceId, getTitle }: { pieceId: string; getTitle: () => string }) {
  const editor = useEditorRef();
  const readDraft = useCallback(() => captureDraft(pieceId, getTitle(), editor.children), [pieceId, getTitle, editor]);
  const navigate = useCallback((expected: Draft, range: TextRange) => {
    if (readDraft().source !== expected.source) return false;
    editor.tf.select(range);
    editor.tf.focus();
    return true;
  }, [editor, readDraft]);
  return <ManuscriptDeskView key={pieceId} pieceId={pieceId} readDraft={readDraft} navigate={navigate} />;
}
