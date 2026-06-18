import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { Value } from "platejs";
import { describe, expect, it } from "vitest";

import { PieceBody } from "./piece-body";

// render the server component to a static html string ... no dom, no browser.
// this is the integration boundary for the public reading view: stored plate
// json in, sanitized magazine html out.
function html(value: unknown): string {
  return renderToStaticMarkup(createElement(PieceBody, { value: value as unknown as Value }));
}

const link = (url: string, text: string) => ({ type: "a", url, children: [{ text }] });
const para = (children: unknown[]) => ({ type: "p", children });

describe("PieceBody inline links", () => {
  it("renders a safe link as a real anchor with hardened rel", () => {
    const out = html([
      para([{ text: "see " }, link("https://example.com/x", "this"), { text: "." }]),
    ]);
    expect(out).toContain('href="https://example.com/x"');
    expect(out).toContain(">this</a>");
    expect(out).toContain('rel="nofollow noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it("drops a javascript: scheme but keeps the visible words", () => {
    const out = html([para([link("javascript:alert(1)", "click me")])]);
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<a ");
    expect(out).toContain("click me");
  });

  it("drops a data: scheme and keeps the text", () => {
    const out = html([para([link("data:text/html,<script>1</script>", "x")])]);
    expect(out).not.toContain("<a ");
    expect(out.toLowerCase()).not.toContain("data:");
  });

  it("permits mailto and tel anchors", () => {
    const out = html([
      para([link("mailto:dom@nova.press", "write")]),
      para([link("tel:+15551234567", "call")]),
    ]);
    expect(out).toContain('href="mailto:dom@nova.press"');
    expect(out).toContain('href="tel:+15551234567"');
  });

  it("preserves marks nested inside a link", () => {
    const out = html([
      para([{ type: "a", url: "https://x.com", children: [{ text: "loud", bold: true }] }]),
    ]);
    expect(out).toContain("<a ");
    expect(out).toContain("<strong>loud</strong>");
  });

  it("marks a first paragraph that opens with a link as the lead (dropcap)", () => {
    const out = html([para([link("https://example.com", "nova"), { text: " is the studio." }])]);
    expect(out).toContain("data-lead");
    expect(out).toContain("<a ");
  });

  it("still renders plain blocks and grouped lists (regression)", () => {
    const out = html([
      { type: "p", children: [{ text: "hi" }] },
      { type: "ul_li", children: [{ text: "one" }] },
      { type: "ul_li", children: [{ text: "two" }] },
    ]);
    expect(out).toContain("hi");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain("<li>two</li>");
  });
});
