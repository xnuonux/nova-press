// nova press · the mythos · the paged layout model (pure css builder).
//
// the print-grade page, as data: a trade-book page size, mirrored margins
// (inner gutter wider than the outer edge), running heads set from the live
// chapter title (css string-set), folios, and the front/back matter on its
// own quiet page master with no marginalia. pagedjs reads exactly this css
// in headless chromium and breaks the book into real pages ... nothing here
// is nova-brand chrome, it is book typography.
//
// pure (a string in, a string out), unit-tested. the impure render lives in
// pdf.ts; the html assembly in book.ts.

export interface PageModel {
  /** css @page size, e.g. "6in 9in" (a classic trade book). */
  size: string;
  marginTop: string;
  marginBottom: string;
  /** the spine-side margin ... wider, the page has to live in a binding. */
  marginInner: string;
  /** the outer edge margin. */
  marginOuter: string;
  bodyFontSizePt: number;
  /** unitless line-height. */
  bodyLeading: number;
}

/** the default: a 6x9 trade page, 10.5pt serif over a generous lead. */
export const TRADE_PAGE: PageModel = {
  size: "6in 9in",
  marginTop: "0.75in",
  marginBottom: "0.8in",
  marginInner: "0.85in",
  marginOuter: "0.65in",
  bodyFontSizePt: 10.5,
  bodyLeading: 1.45,
};

/** escape a string for a css content: "..." literal ... backslashes and
 *  quotes escaped, whitespace runs (a raw newline would end the declaration)
 *  flattened to one space, and angle brackets hex-escaped: this string lands
 *  inside an inline <style> block, so a literal "</style>" in a work's title
 *  must never be able to close it and smuggle markup into the renderer. */
export function cssString(s: string): string {
  return (
    s
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      // flatten BEFORE the hex escapes ... their trailing terminator space
      // must survive (a flattened "\3c " would swallow following hex chars).
      .replace(/\s+/g, " ")
      .replace(/</g, "\\3c ")
      .replace(/>/g, "\\3e ")
  );
}

const SERIF = `"IBM Plex Serif", Georgia, "Times New Roman", serif`;
const MONO = `Iosevka, "Courier New", monospace`;

/**
 * the whole book stylesheet: the page masters (@page + named pages with
 * running heads and folios), then the text typography (justified, manually
 * hyphenated, widow/orphan-guarded), then the matter + section layout.
 */
export function bookCss(model: PageModel, opts: { runningTitle: string }): string {
  const title = cssString(opts.runningTitle);
  return `
@page {
  size: ${model.size};
  margin-top: ${model.marginTop};
  margin-bottom: ${model.marginBottom};
}
@page :left {
  margin-left: ${model.marginOuter};
  margin-right: ${model.marginInner};
}
@page :right {
  margin-left: ${model.marginInner};
  margin-right: ${model.marginOuter};
}

/* the body master ... folios below, running heads above: the work's title on
   the verso, the living chapter title on the recto. */
@page body {
  @bottom-center {
    content: counter(page);
    font-family: ${SERIF};
    font-size: 8.5pt;
    color: #333333;
  }
}
@page body:left {
  @top-left {
    content: "${title}";
    font-family: ${SERIF};
    font-size: 8pt;
    letter-spacing: 0.14em;
    color: #444444;
  }
}
@page body:right {
  @top-right {
    content: string(np-chapter-head);
    font-family: ${SERIF};
    font-size: 8pt;
    letter-spacing: 0.14em;
    color: #444444;
  }
}
/* a chapter opener carries a drop folio only ... no running head. */
@page body:first {
  @top-left { content: none; }
  @top-right { content: none; }
}

/* the matter master ... front + back matter run quiet: no heads, no folios. */
@page matter {
  @top-left { content: none; }
  @top-right { content: none; }
  @bottom-center { content: none; }
}

html, body {
  margin: 0;
  padding: 0;
}
body {
  font-family: ${SERIF};
  font-size: ${model.bodyFontSizePt}pt;
  line-height: ${model.bodyLeading};
  color: #111111;
  font-kerning: normal;
  font-variant-ligatures: common-ligatures;
}

p {
  margin: 0;
  text-align: justify;
  text-indent: 1.35em;
  orphans: 2;
  widows: 2;
  hyphens: manual;
  overflow-wrap: break-word;
}
/* the first paragraph after a heading (or opening a chapter) sets flush. */
h1 + p, h2 + p, h3 + p, h4 + p,
.np-chapter-body > p:first-child,
blockquote > p:first-child {
  text-indent: 0;
}

h1, h2, h3, h4 {
  font-weight: 500;
  hyphens: none;
  text-align: left;
  break-after: avoid;
}
h2 { font-size: 13pt; margin: 1.6em 0 0.7em; }
h3 { font-size: 11.5pt; margin: 1.4em 0 0.6em; }
h4 { font-size: ${model.bodyFontSizePt}pt; font-style: italic; margin: 1.2em 0 0.5em; }

blockquote {
  margin: 1em 1.6em;
  font-style: italic;
}
ul, ol {
  margin: 0.8em 0 0.8em 1.6em;
  padding: 0;
}
li { margin: 0.15em 0; }

code {
  font-family: ${MONO};
  font-size: 0.88em;
  hyphens: none;
}
a {
  color: inherit;
  text-decoration: none;
}

/* a scene break ... three quiet dots, never a rule that shouts. */
hr {
  border: none;
  margin: 1.4em 0;
  text-align: center;
}
hr::after {
  content: "\\00b7 \\00a0 \\00b7 \\00a0 \\00b7";
  color: #555555;
  letter-spacing: 0.2em;
}

/* verse holds its lines ... never justified, never hyphenated. */
.np-verse {
  margin: 1.1em 0 1.1em 1.5em;
  text-align: left;
  hyphens: none;
  break-inside: avoid;
}

/* ---- the matter ---- */

.np-matter {
  page: matter;
  break-before: page;
}
.np-half-title h1 {
  margin-top: 34%;
  text-align: center;
  font-size: 16pt;
  letter-spacing: 0.04em;
}
.np-title-page h1 {
  margin-top: 30%;
  text-align: center;
  font-size: 24pt;
  letter-spacing: 0.02em;
}
.np-title-form {
  margin-top: 1.2em;
  text-align: center;
  text-indent: 0;
  font-size: 10pt;
  font-style: italic;
  color: #333333;
}
.np-title-press {
  margin-top: 42%;
  text-align: center;
  text-indent: 0;
  font-size: 9pt;
  letter-spacing: 0.22em;
  color: #444444;
}
.np-copyright p {
  margin-top: 0.5em;
  text-align: center;
  text-indent: 0;
  font-size: 8.5pt;
  color: #333333;
}
.np-copyright p:first-child {
  margin-top: 72%;
}
.np-contents h2 {
  text-align: center;
  font-size: 13pt;
  letter-spacing: 0.1em;
  margin: 2.4em 0 1.8em;
}
.np-contents ol {
  list-style: none;
  margin: 0;
  padding: 0;
}
.np-contents li {
  margin: 0.45em 0;
  text-indent: 0;
}
.np-contents li.np-toc-depth-1 { margin-left: 1.2em; }
.np-contents li.np-toc-depth-2 { margin-left: 2.4em; }
.np-contents li.np-toc-depth-3 { margin-left: 3.6em; }
.np-contents a::after {
  content: target-counter(attr(href), page);
  float: right;
}
.np-colophon p {
  text-align: center;
  text-indent: 0;
  font-size: 8.5pt;
  color: #333333;
  margin-top: 0.5em;
}
.np-colophon p:first-child {
  margin-top: 60%;
}

/* ---- the body sections ---- */

/* a part (a container node) opens on a fresh recto, alone on its page. */
.np-part {
  page: body;
  break-before: right;
}
.np-part-title {
  margin-top: 30%;
  text-align: center;
  font-size: 17pt;
  letter-spacing: 0.05em;
}

/* a chapter (a leaf) opens on a fresh page with a dropped title. */
.np-chapter {
  page: body;
  break-before: page;
}
.np-chapter-title {
  string-set: np-chapter-head content(text);
  margin: 1.1in 0 2em;
  text-align: center;
  font-size: 14pt;
  letter-spacing: 0.05em;
}

/* folios number the PHYSICAL pages from the half title on (they simply never
   print on matter pages). a counter-reset at the first body section was tried
   and dropped: pagedjs honors an element reset for target-counter but not for
   the margin-box folio, and a contents page must never disagree with the folio
   it points at. one counter, one truth. */
`;
}
