import { Fragment, type ReactNode } from "react";

import type { Value } from "platejs";

import { groupBodyBlocks } from "./piece-blocks";
import { isSafeHref } from "./sanitize-href";

/**
 * renders a stored plate v49 body as magazine reading prose. server component,
 * so the text is react-escaped ... no html injection from the body json. total
 * over garbage (an unknown block or a malformed leaf degrades to a paragraph /
 * empty string) so a corrupt body can never 500 the public reading view.
 *
 * inline links are real elements nested in a block's children, so the children
 * walk recurses: an anchor renders as <a> only if its url clears isSafeHref
 * (http/https/mailto/tel), otherwise the words survive and the hostile href is
 * dropped. that gate is the stored-xss boundary for this public, server-rendered
 * page.
 */

interface Leaf {
  text?: unknown;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

function renderLeaf(leaf: Leaf, key: number): ReactNode {
  const text = typeof leaf.text === "string" ? leaf.text : "";
  let node: ReactNode = text;
  if (leaf.code) node = <code>{node}</code>;
  if (leaf.bold) node = <strong>{node}</strong>;
  if (leaf.italic) node = <em>{node}</em>;
  if (leaf.underline) node = <u>{node}</u>;
  if (leaf.strikethrough) node = <s>{node}</s>;
  return <Fragment key={key}>{node}</Fragment>;
}

function renderInline(child: unknown, key: number): ReactNode {
  const node = (child ?? {}) as { type?: unknown; url?: unknown; children?: unknown };
  // an inline element carries a string "type" (e.g. "a"); a leaf has none.
  if (typeof node.type === "string") {
    const inner = renderChildren(node.children);
    if (node.type === "a" && isSafeHref(node.url)) {
      return (
        <a key={key} href={node.url as string} target="_blank" rel="nofollow noopener noreferrer">
          {inner}
        </a>
      );
    }
    // unknown inline element, or a link with an unsafe url ... keep the words,
    // drop the wrapper. a hostile href never reaches the rendered dom.
    return <Fragment key={key}>{inner}</Fragment>;
  }
  return renderLeaf(node as Leaf, key);
}

function renderChildren(children: unknown): ReactNode {
  if (!Array.isArray(children)) return null;
  return children.map((child, i) => renderInline(child, i));
}

function blockHasText(children: unknown): boolean {
  if (!Array.isArray(children)) return false;
  return children.some((child) => {
    const node = (child ?? {}) as { text?: unknown; children?: unknown };
    if (typeof node.text === "string" && node.text.trim() !== "") return true;
    // text inside an inline element (e.g. a link) lives in its children, so a
    // paragraph that opens with a link still counts as a lead paragraph.
    return blockHasText(node.children);
  });
}

export function PieceBody({ value }: { value: Value }) {
  if (!Array.isArray(value)) return null;
  // the lead-paragraph + dropcap treatment belongs to the first paragraph with
  // real text ... not whatever <p> happens to come first when a piece opens
  // with a heading, a quote, or an empty line. css keys off [data-lead].
  const leadIndex = value.findIndex((node) => {
    const block = (node ?? {}) as { type?: string; children?: unknown };
    return (!block.type || block.type === "p") && blockHasText(block.children);
  });
  // consecutive list-item blocks (ul_li / ol_li) restitch into real ul/ol; the
  // original index rides each group so the lead-paragraph dropcap still keys off
  // its true position in the document.
  const groups = groupBodyBlocks(value);
  return (
    <>
      {groups.map((group) => {
        if (group.kind === "list") {
          const items = group.items.map(({ block, index }) => (
            <li key={index}>{renderChildren(block.children)}</li>
          ));
          const key = `list-${group.items[0]?.index ?? 0}`;
          return group.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
        }
        if (group.kind === "verse") {
          // a poem ... each line is a block-level span so breaks are preserved;
          // an empty line holds its height (a stanza gap) via a nbsp.
          const lines = group.items.map(({ block, index }) => (
            <span key={index} className="np-verse-line">
              {blockHasText(block.children) ? renderChildren(block.children) : " "}
            </span>
          ));
          return (
            <div key={`verse-${group.items[0]?.index ?? 0}`} className="np-verse">
              {lines}
            </div>
          );
        }
        const { block, index } = group;
        const kids = renderChildren(block.children);
        switch (block.type) {
          // the article title is the h1, so body headings shift down a level.
          case "h1":
            return <h2 key={index}>{kids}</h2>;
          case "h2":
            return <h3 key={index}>{kids}</h3>;
          case "h3":
            return <h4 key={index}>{kids}</h4>;
          case "blockquote":
            return <blockquote key={index}>{kids}</blockquote>;
          case "hr":
            return <hr key={index} aria-hidden />;
          default:
            return (
              <p key={index} data-lead={index === leadIndex ? "" : undefined}>
                {kids}
              </p>
            );
        }
      })}
    </>
  );
}
