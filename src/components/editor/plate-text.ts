/**
 * pulls plain text out of a plate document, derives an excerpt, and coerces
 * an untrusted body into a valid plate value.
 *
 * the body column on np_pieces is untyped jsonb, so on read these functions
 * may receive arbitrary shapes (a corrupted write, a migration bug, a future
 * plate version). they must be total over garbage ... a malformed node must
 * never throw, or it would 500 the editor route and lock the writer out of
 * their own piece. pure, so they can be unit-tested without booting the editor.
 */

import type { Value } from "platejs";

// a plate document needs at least one node, so an empty/invalid body falls
// back to a single empty paragraph.
const EMPTY_DOC: Value = [{ type: "p", children: [{ text: "" }] }];

function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const text = (node as { text?: unknown }).text;
  if (typeof text === "string") return text;
  const children = (node as { children?: unknown }).children;
  if (Array.isArray(children)) return children.map(nodeText).join("");
  return "";
}

export function plateText(value: Value): string {
  if (!Array.isArray(value)) return "";
  return value.map(nodeText).join("\n");
}

/**
 * derives a one-line excerpt from a plate document ... feeds np_pieces.excerpt
 * and the library card preview. collapses block newlines and whitespace runs
 * into single spaces, trims, and truncates with a trailing ellipsis.
 */
export function deriveExcerpt(value: Value, maxChars = 160): string {
  const flat = plateText(value).replace(/\s+/g, " ").trim();
  if (flat.length <= maxChars) return flat;
  let cut = flat.slice(0, maxChars);
  // never split an astral char ... drop a trailing lone high surrogate so the
  // preview can't render a U+FFFD replacement glyph.
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  return cut.trimEnd() + "...";
}

/**
 * coerces an untrusted body (untyped jsonb from np_pieces) into a value plate
 * can mount. a non-array, an empty array, or any top-level node missing a
 * children array degrades to a recoverable empty draft rather than a crash.
 */
export function coercePlateValue(body: unknown): Value {
  if (!Array.isArray(body) || body.length === 0) return EMPTY_DOC;
  const allNodesPlausible = body.every(
    (node) =>
      !!node &&
      typeof node === "object" &&
      Array.isArray((node as { children?: unknown }).children),
  );
  return allNodesPlausible ? (body as Value) : EMPTY_DOC;
}
