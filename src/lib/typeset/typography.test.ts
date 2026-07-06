import { describe, it, expect } from "vitest";

import {
  smartenHtml,
  smartenPlain,
  hyphenateHtml,
  widowGuardHtml,
  typesetHtml,
  NBSP,
  SHY,
  ELLIPSIS,
} from "./typography";

describe("smartenHtml curls quotes with the editor's own direction rule", () => {
  it("curls a quoted phrase ... open after a space, close after a word", () => {
    expect(smartenHtml("<p>she said, &quot;go home.&quot;</p>")).toBe(
      "<p>she said, “go home.”</p>",
    );
  });

  it("turns an in-word straight apostrophe into a right single quote", () => {
    expect(smartenHtml("<p>it&#39;s marik&#39;s boat</p>")).toBe("<p>it’s marik’s boat</p>");
  });

  it("opens a single quote after a space (the editor's own limitation, mirrored)", () => {
    expect(smartenHtml("<p>so &#39;tis said</p>")).toBe("<p>so ‘tis said</p>");
  });

  it("lets quote direction flow through an inline mark", () => {
    expect(smartenHtml("<p>&quot;the <strong>gate</strong>&quot; groaned</p>")).toBe(
      "<p>“the <strong>gate</strong>” groaned</p>",
    );
  });

  it("resets direction at a block boundary ... a new paragraph opens fresh", () => {
    expect(smartenHtml("<p>word</p>\n<p>&quot;fresh&quot;</p>")).toBe(
      "<p>word</p>\n<p>“fresh”</p>",
    );
  });

  it("leaves code spans exactly as written, and reads on after them", () => {
    expect(smartenHtml("<p>run <code>&quot;raw&quot;</code>&#39;s output</p>")).toBe(
      "<p>run <code>&quot;raw&quot;</code>’s output</p>",
    );
  });

  it("turns exactly three dots into an ellipsis glyph", () => {
    expect(smartenHtml("<p>wait... no</p>")).toBe(`<p>wait${ELLIPSIS} no</p>`);
  });

  it("leaves a longer dot run alone (a deliberate fade)", () => {
    expect(smartenHtml("<p>gone....</p>")).toBe("<p>gone....</p>");
  });

  it("never creates a dash ... -- passes through untouched", () => {
    const out = smartenHtml("<p>stay -- go</p>");
    expect(out).toBe("<p>stay -- go</p>");
    expect(out.includes(String.fromCharCode(0x2014))).toBe(false);
    expect(out.includes(String.fromCharCode(0x2013))).toBe(false);
  });

  it("keeps escaping intact ... an ampersand round-trips encoded", () => {
    expect(smartenHtml("<p>smith &amp; sons&#39; shop</p>")).toBe("<p>smith &amp; sons’ shop</p>");
  });

  it("leaves an ellipsis split by an inline mark as printed dots (the pinned limit)", () => {
    expect(smartenHtml("<p>wait..<em>.</em> go</p>")).toBe("<p>wait..<em>.</em> go</p>");
  });
});

describe("smartenPlain dresses a bare string (the running head, the doc title)", () => {
  it("curls quotes and ellipses the dots, same as the body", () => {
    expect(smartenPlain(`marik's "gate"...`)).toBe("marik’s “gate”…");
  });
});

describe("hyphenateHtml plants soft hyphens in prose only", () => {
  it("soft-hyphenates a long word in a paragraph", () => {
    const out = hyphenateHtml("<p>an extraordinary understanding</p>");
    expect(out.includes(SHY)).toBe(true);
  });

  it("never touches a heading, code, or verse", () => {
    expect(hyphenateHtml("<h2>extraordinary</h2>")).toBe("<h2>extraordinary</h2>");
    expect(hyphenateHtml("<p><code>extraordinary</code></p>")).toBe(
      "<p><code>extraordinary</code></p>",
    );
    expect(hyphenateHtml('<div class="np-verse">extraordinary<br/>lines</div>')).toBe(
      '<div class="np-verse">extraordinary<br/>lines</div>',
    );
  });

  it("resumes hyphenating after a verse block closes", () => {
    const out = hyphenateHtml('<div class="np-verse">line</div>\n<p>extraordinary</p>');
    const after = out.split("</div>")[1]!;
    expect(after.includes(SHY)).toBe(true);
  });
});

describe("widowGuardHtml joins the last two words of a long paragraph", () => {
  it("replaces the final inter-word space with a no-break space", () => {
    expect(widowGuardHtml("<p>one two three four five</p>")).toBe(
      `<p>one two three four${NBSP}five</p>`,
    );
  });

  it("leaves a short paragraph alone", () => {
    expect(widowGuardHtml("<p>go now</p>")).toBe("<p>go now</p>");
  });

  it("finds the join across an inline mark at the end", () => {
    expect(widowGuardHtml("<p>one two three four <em>five</em></p>")).toBe(
      `<p>one two three four${NBSP}<em>five</em></p>`,
    );
    expect(widowGuardHtml("<p>one two three <em>four five</em></p>")).toBe(
      `<p>one two three <em>four${NBSP}five</em></p>`,
    );
  });

  it("skips a paragraph holding inline code (a glued space would edit it)", () => {
    const html = "<p>run it with one two <code>pnpm dev</code></p>";
    expect(widowGuardHtml(html)).toBe(html);
  });

  it("treats an already-glued nbsp pair as guarded ... no earlier space stolen", () => {
    const html = `<p>one two three four${NBSP}five</p>`;
    expect(widowGuardHtml(html)).toBe(html);
  });

  it("glues across a raw newline separator (the same whitespace the gate counts)", () => {
    expect(widowGuardHtml("<p>one two three four\nfive</p>")).toBe(
      `<p>one two three four${NBSP}five</p>`,
    );
  });

  it("only guards paragraphs ... a heading or list is left alone", () => {
    const html = "<h2>one two three four five</h2><ul><li>a b c d e</li></ul>";
    expect(widowGuardHtml(html)).toBe(html);
  });
});

describe("typesetHtml composes the full pass", () => {
  it("curls, hyphenates, and guards in one sweep", () => {
    const out = typesetHtml(
      "<p>she said, &quot;something extraordinary happened down there... believe me.&quot;</p>",
    );
    expect(out.includes("“")).toBe(true);
    expect(out.includes("”")).toBe(true);
    expect(out.includes(ELLIPSIS)).toBe(true);
    expect(out.includes(SHY)).toBe(true);
    expect(out.includes(NBSP)).toBe(true);
    expect(out.includes("&quot;")).toBe(false);
  });

  it("emits no em-dash and no en-dash, ever", () => {
    const out = typesetHtml(
      "<p>a plain paragraph -- with a double dash... and quotes: &quot;x&quot;</p>",
    );
    expect(out.includes(String.fromCharCode(0x2014))).toBe(false);
    expect(out.includes(String.fromCharCode(0x2013))).toBe(false);
  });
});
