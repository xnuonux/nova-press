import { describe, it, expect } from "vitest";

import { slateToHtml } from "./html";

describe("slateToHtml serializes a plate value to safe, escaped html", () => {
  it("renders paragraphs and shifts headings down one level", () => {
    const html = slateToHtml([
      { type: "h1", children: [{ text: "Title" }] },
      { type: "p", children: [{ text: "a line" }] },
    ] as never);
    expect(html).toBe("<h2>Title</h2>\n<p>a line</p>");
  });

  it("applies marks as nested inline tags", () => {
    const html = slateToHtml([
      {
        type: "p",
        children: [
          { text: "bold", bold: true },
          { text: " and ", italic: true },
        ],
      },
    ] as never);
    expect(html).toBe("<p><strong>bold</strong><em> and </em></p>");
  });

  it("escapes html so a body can never inject markup", () => {
    const html = slateToHtml([
      { type: "p", children: [{ text: '<script>alert(1)</script> & "x"' }] },
    ] as never);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;");
    expect(html).not.toContain("<script>");
  });

  it("keeps a safe link, drops an unsafe href but keeps the words", () => {
    const safe = slateToHtml([
      { type: "p", children: [{ type: "a", url: "https://x.com", children: [{ text: "go" }] }] },
    ] as never);
    expect(safe).toBe('<p><a href="https://x.com">go</a></p>');
    const unsafe = slateToHtml([
      {
        type: "p",
        children: [{ type: "a", url: "javascript:evil()", children: [{ text: "go" }] }],
      },
    ] as never);
    expect(unsafe).toBe("<p>go</p>");
  });

  it("restitches consecutive list items into a single ul / ol", () => {
    const html = slateToHtml([
      { type: "ul_li", children: [{ text: "one" }] },
      { type: "ul_li", children: [{ text: "two" }] },
      { type: "p", children: [{ text: "after" }] },
    ] as never);
    expect(html).toBe("<ul><li>one</li><li>two</li></ul>\n<p>after</p>");
  });

  it("renders an hr as a self-closed rule", () => {
    expect(slateToHtml([{ type: "hr", children: [{ text: "" }] }] as never)).toBe("<hr/>");
  });
});
