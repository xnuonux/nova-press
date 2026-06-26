// nova press · the mythos · the markdown <-> slate converter (the io spine).
//
// Slate/Plate JSON is the single source of truth; everything imports INTO it and
// exports OUT of it. this is the first hub: markdown both ways, via a HEADLESS
// plate editor (createSlateEditor ... no react, no dom) registered with the same
// block + mark vocabulary the editor uses, so a `#` round-trips to an h1 and back.
//
// pure (no server-only): the routes (src/app/api/import + /export) are the server
// boundary; this is just the transform, so it stays unit-testable.

import { createSlateEditor, type Value } from "platejs";
import { BaseBasicBlocksPlugin, BaseBasicMarksPlugin } from "@platejs/basic-nodes";
import { BaseLinkPlugin } from "@platejs/link";
import { deserializeMd, serializeMd, MarkdownPlugin } from "@platejs/markdown";

// a plate document needs at least one node; an empty import degrades here, the
// same recoverable shape coercePlateValue falls back to.
const EMPTY_DOC: Value = [{ type: "p", children: [{ text: "" }] }];

// the conversion engine: a throwaway headless editor that knows headings,
// blockquote, hr, the basic marks (bold/italic/code/...), and links ... the
// common markdown vocabulary. one per call keeps it stateless + safe.
function makeEditor() {
  return createSlateEditor({
    plugins: [BaseBasicBlocksPlugin, BaseBasicMarksPlugin, BaseLinkPlugin, MarkdownPlugin],
  });
}

/** markdown text -> a plate Value. an empty / unparseable input degrades to a
 *  recoverable empty doc rather than throwing (it must never 500 an import). */
export function markdownToSlate(markdown: string): Value {
  const editor = makeEditor();
  const value = deserializeMd(editor, markdown ?? "");
  return Array.isArray(value) && value.length > 0 ? (value as Value) : EMPTY_DOC;
}

/** a plate Value -> markdown text. */
export function slateToMarkdown(value: Value): string {
  const editor = makeEditor();
  return serializeMd(editor, { value });
}
