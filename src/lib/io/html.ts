// nova press · the mythos · a pure Slate -> html serializer (the epub/print arm
// of the io spine). Slate/Plate JSON stays the single source of truth; this
// emits clean, escaped html for the epub builder (and any future html export).
//
// it mirrors the reading renderer (src/components/reading/piece-body.tsx) block
// for block, but produces a STRING with every text node html-escaped, so a body
// can never inject markup. only http/https/mailto/tel links survive; an unsafe
// href is dropped and the words kept. pure (no server-only), unit-tested.

import type { Value } from "platejs";

import { isSafeHref } from "@/components/reading/sanitize-href";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Leaf {
  text?: unknown;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

function renderLeaf(leaf: Leaf): string {
  let html = escapeHtml(typeof leaf.text === "string" ? leaf.text : "");
  if (leaf.code) html = `<code>${html}</code>`;
  if (leaf.bold) html = `<strong>${html}</strong>`;
  if (leaf.italic) html = `<em>${html}</em>`;
  if (leaf.underline) html = `<u>${html}</u>`;
  if (leaf.strikethrough) html = `<s>${html}</s>`;
  return html;
}

function renderInline(child: unknown): string {
  const node = (child ?? {}) as { type?: unknown; url?: unknown; children?: unknown };
  if (typeof node.type === "string") {
    const inner = renderChildren(node.children);
    if (node.type === "a" && isSafeHref(node.url)) {
      return `<a href="${escapeHtml(node.url as string)}">${inner}</a>`;
    }
    // unknown inline / unsafe href ... keep the words, drop the wrapper.
    return inner;
  }
  return renderLeaf(node as Leaf);
}

function renderChildren(children: unknown): string {
  if (!Array.isArray(children)) return "";
  return children.map((c) => renderInline(c)).join("");
}

/** a plate Value -> a safe html string. consecutive list items restitch into a
 *  single ul/ol; headings shift down one level (the chapter title is the h1). */
export function slateToHtml(value: Value): string {
  if (!Array.isArray(value)) return "";
  const out: string[] = [];
  let listKind: "ul" | "ol" | null = null;
  const items: string[] = [];

  const flushList = (): void => {
    if (listKind && items.length > 0) {
      out.push(`<${listKind}>${items.map((i) => `<li>${i}</li>`).join("")}</${listKind}>`);
    }
    listKind = null;
    items.length = 0;
  };

  for (const node of value) {
    const block = (node ?? {}) as { type?: string; children?: unknown };
    const kind = block.type === "ul_li" ? "ul" : block.type === "ol_li" ? "ol" : null;
    if (kind) {
      if (listKind && listKind !== kind) flushList();
      listKind = kind;
      items.push(renderChildren(block.children));
      continue;
    }
    flushList();
    const inner = renderChildren(block.children);
    switch (block.type) {
      case "h1":
        out.push(`<h2>${inner}</h2>`);
        break;
      case "h2":
        out.push(`<h3>${inner}</h3>`);
        break;
      case "h3":
        out.push(`<h4>${inner}</h4>`);
        break;
      case "blockquote":
        out.push(`<blockquote>${inner}</blockquote>`);
        break;
      case "hr":
        out.push("<hr/>");
        break;
      default:
        out.push(`<p>${inner}</p>`);
    }
  }
  flushList();
  return out.join("\n");
}
