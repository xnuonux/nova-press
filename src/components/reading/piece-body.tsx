import { Fragment, type ReactNode } from "react";

import type { Value } from "platejs";

/**
 * renders a stored plate v49 body as magazine reading prose. server component,
 * so the text is react-escaped ... no html injection from the body json. total
 * over garbage (an unknown block or a malformed leaf degrades to a paragraph /
 * empty string) so a corrupt body can never 500 the public reading view.
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

function renderChildren(children: unknown): ReactNode {
  if (!Array.isArray(children)) return null;
  return children.map((child, i) => renderLeaf((child ?? {}) as Leaf, i));
}

function blockHasText(children: unknown): boolean {
  if (!Array.isArray(children)) return false;
  return children.some((child) => {
    const t = (child as { text?: unknown })?.text;
    return typeof t === "string" && t.trim() !== "";
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
  return (
    <>
      {value.map((node, i) => {
        const block = (node ?? {}) as { type?: string; children?: unknown };
        const kids = renderChildren(block.children);
        switch (block.type) {
          // the article title is the h1, so body headings shift down a level.
          case "h1":
            return <h2 key={i}>{kids}</h2>;
          case "h2":
            return <h3 key={i}>{kids}</h3>;
          case "h3":
            return <h4 key={i}>{kids}</h4>;
          case "blockquote":
            return <blockquote key={i}>{kids}</blockquote>;
          case "hr":
            return <hr key={i} aria-hidden />;
          default:
            return (
              <p key={i} data-lead={i === leadIndex ? "" : undefined}>
                {kids}
              </p>
            );
        }
      })}
    </>
  );
}
