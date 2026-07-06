import { describe, it, expect } from "vitest";

import { assembleBookBody, bookDocument, composeBookHtml, formLine } from "./book";
import { bookCss, cssString, TRADE_PAGE } from "./page-css";

const SECTIONS = [
  { title: "act one", depth: 0, isLeaf: false, html: "" },
  { title: "the ferry", depth: 1, isLeaf: true, html: "<p>marik stood at the water.</p>" },
  { title: "", depth: 1, isLeaf: true, html: "<p>the gate groaned open.</p>" },
];

describe("formLine names the form for the title page", () => {
  it("picks the article by the first sound", () => {
    expect(formLine("novel")).toBe("a novel");
    expect(formLine("encyclopaedia")).toBe("an encyclopaedia");
  });
  it("reads underscores as spaces and empties as nothing", () => {
    expect(formLine("poetry_collection")).toBe("a poetry collection");
    expect(formLine("")).toBe("");
    expect(formLine(undefined)).toBe("");
  });
});

describe("assembleBookBody builds the matter + the sections", () => {
  const body = assembleBookBody({
    title: "the seventh gate",
    formProfile: "novel",
    year: 2026,
    sections: SECTIONS,
  });

  it("opens with a half title and a full title page", () => {
    expect(body).toContain('class="np-matter np-half-title"');
    expect(body).toContain('class="np-matter np-title-page"');
    expect(body).toContain("<h1>the seventh gate</h1>");
    expect(body).toContain('<p class="np-title-form">a novel</p>');
  });

  it("carries the year on the copyright page and the colophon", () => {
    expect(body).toContain("© 2026 the author");
    expect(body).toContain("nova press · 2026");
  });

  it("links the contents to section ids, depth-indented", () => {
    expect(body).toContain('<a href="#np-sec-0">act one</a>');
    expect(body).toContain('<a href="#np-sec-1">the ferry</a>');
    expect(body).toContain('class="np-toc-depth-1"');
  });

  it("renders a container as a part page and a leaf as a chapter", () => {
    expect(body).toContain('<h2 class="np-part-title">act one</h2>');
    expect(body).toContain('<h2 class="np-chapter-title">the ferry</h2>');
    expect(body).toContain("<p>marik stood at the water.</p>");
  });

  it("names an untitled leaf by its chapter ordinal", () => {
    expect(body).toContain('<h2 class="np-chapter-title">chapter 2</h2>');
    expect(body).toContain('<a href="#np-sec-2">chapter 2</a>');
  });

  it("gives every section its stable anchor id", () => {
    expect(body).toContain('class="np-part" id="np-sec-0"');
    expect(body).toContain('class="np-chapter" id="np-sec-1"');
    expect(body).toContain('class="np-chapter" id="np-sec-2"');
  });

  it("escapes a hostile title everywhere it lands", () => {
    const hostile = assembleBookBody({
      title: 'x <script>alert(1)</script> & "y"',
      year: 2026,
      sections: [{ title: "<b>ch</b>", depth: 0, isLeaf: true, html: "<p>ok</p>" }],
    });
    expect(hostile).not.toContain("<script>");
    expect(hostile).toContain("&lt;script&gt;");
    expect(hostile).toContain("&lt;b&gt;ch&lt;/b&gt;");
  });

  it("ships an empty leaf as a valid empty paragraph", () => {
    const out = assembleBookBody({
      title: "t",
      year: 2026,
      sections: [{ title: "ch", depth: 0, isLeaf: true, html: "" }],
    });
    expect(out).toContain("<p></p>");
  });
});

describe("bookCss is the page master", () => {
  const css = bookCss(TRADE_PAGE, { runningTitle: "the seventh gate" });

  it("sets the trade page and mirrored margins", () => {
    expect(css).toContain("size: 6in 9in");
    expect(css).toContain("@page :left");
    expect(css).toContain("@page :right");
  });

  it("sets running heads from the title and the live chapter", () => {
    expect(css).toContain('content: "the seventh gate"');
    expect(css).toContain("string(np-chapter-head)");
    expect(css).toContain("string-set: np-chapter-head content(text)");
  });

  it("counts real page numbers into the contents off the one physical counter", () => {
    expect(css).toContain("target-counter(attr(href), page)");
    // the tried-and-dropped element reset must never come back ... it split
    // the toc numbers from the printed folios.
    expect(css).not.toContain("counter-reset: page");
  });

  it("keeps the matter quiet ... no heads, no folios", () => {
    expect(css).toContain("@page matter");
  });

  it("escapes a css-hostile running title", () => {
    expect(cssString('a "quoted" title')).toBe('a \\"quoted\\" title');
    expect(cssString("back\\slash")).toBe("back\\\\slash");
    expect(cssString("two\nlines")).toBe("two lines");
  });

  it("hex-escapes angle brackets so a title can never close the style block", () => {
    expect(cssString("</style>")).toBe("\\3c /style\\3e ");
    const doc = composeBookHtml({
      title: "</style><script>alert(1)</script>",
      year: 2026,
      sections: [],
    });
    expect(doc).not.toContain("<script>");
    expect(doc.match(/<\/style>/g)?.length).toBe(1);
  });

  it("curls the running head the same way the body curls the title", () => {
    const doc = composeBookHtml({
      title: `marik's "gate"`,
      year: 2026,
      sections: [{ title: "ch", depth: 0, isLeaf: true, html: "<p>ok</p>" }],
    });
    // the css running head carries the curled title, not the straight one
    expect(doc).toContain('content: "marik’s “gate”"');
    // and the half-title h1 agrees with it
    expect(doc).toContain("<h1>marik’s “gate”</h1>");
  });
});

describe("composeBookHtml is the whole document", () => {
  it("wraps the typeset body with the page masters", () => {
    const doc = composeBookHtml({
      title: "the seventh gate",
      formProfile: "novel",
      year: 2026,
      sections: [
        {
          title: "the ferry",
          depth: 0,
          isLeaf: true,
          html: "<p>she said, &quot;the water remembers everything we gave it.&quot;</p>",
        },
      ],
    });
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain("<style>");
    expect(doc).toContain("@page body");
    // the typography pass ran over the assembled body (the curl landed; the
    // exact word may carry soft hyphens, so match the opening quote alone)
    expect(doc).toContain("“the wa");
    expect(doc).not.toContain("&quot;the water");
  });

  it("escapes the document title", () => {
    const doc = bookDocument({ title: "<x>", css: "", bodyHtml: "<p>b</p>" });
    expect(doc).toContain("<title>&lt;x&gt;</title>");
  });
});
