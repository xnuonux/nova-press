/**
 * pulls the plain text out of a plate document ... feeds the word count.
 * pure, so it can be unit-tested without booting the editor.
 */

import type { Value } from "platejs";

type PlateNode = { text: string } | { children: PlateNode[] };

function nodeText(node: PlateNode): string {
  return "text" in node ? node.text : node.children.map(nodeText).join("");
}

export function plateText(value: Value): string {
  // plate node types carry an index signature, so `"text" in node` will not
  // narrow against them ... walk a clean structural shape instead.
  return (value as unknown as PlateNode[]).map(nodeText).join("\n");
}

/**
 * derives a one-line excerpt from a plate document ... feeds np_pieces.excerpt
 * and the library card preview. collapses block newlines and whitespace runs
 * into single spaces, trims, and truncates with a trailing ellipsis.
 * pure, so it can be unit-tested without booting the editor.
 */
export function deriveExcerpt(value: Value, maxChars = 160): string {
  const flat = plateText(value).replace(/\s+/g, " ").trim();
  if (flat.length <= maxChars) return flat;
  return flat.slice(0, maxChars).trimEnd() + "...";
}
