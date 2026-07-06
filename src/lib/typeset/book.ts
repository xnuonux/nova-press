// nova press · the mythos · the book assembly (pure).
//
// a Work's reading sections (the same shape docx + epub eat) become one
// complete, print-shaped html document: front matter (half title, title page,
// copyright, contents), the body (a container node opens a part page, a leaf
// opens a chapter), and back matter (the colophon). pagedjs + the page-css
// masters then break it into real pages with running heads + folios.
//
// pure + unit-tested: no fs, no dates (the caller passes the year), no dep on
// the render engine. every title is escaped here; every leaf body arrives
// already-safe from slateToHtml and is embedded verbatim.

import { escapeHtml } from "@/lib/io/html";

import { bookCss, TRADE_PAGE, type PageModel } from "./page-css";
import { smartenPlain, typesetHtml } from "./typography";

/** one reading section, as the exports already shape it: a container carries
 *  only its title; a leaf carries its serialized-safe html body. */
export interface TypesetSection {
  title: string;
  depth: number;
  isLeaf: boolean;
  html: string;
}

export interface TypesetBookInput {
  title: string;
  /** the work's form, for the title page ("a novel") ... omitted, no line. */
  formProfile?: string;
  /** the copyright + colophon year ... passed in, never read off the clock
   *  (this module stays pure and replayable). */
  year: number;
  sections: readonly TypesetSection[];
}

/** "novel" -> "a novel", "encyclopaedia" -> "an encyclopaedia". underscores
 *  read as spaces; an empty form reads as nothing. */
export function formLine(formProfile: string | undefined): string {
  const label = (formProfile ?? "").trim().replace(/_/g, " ");
  if (!label) return "";
  const article = /^[aeiou]/i.test(label) ? "an" : "a";
  return `${article} ${label}`;
}

/** a leaf with no title still deserves a name on the page ... its 1-based
 *  chapter ordinal. */
function chapterFallback(ordinal: number): string {
  return `chapter ${ordinal}`;
}

/**
 * the body inner html: matter + parts + chapters, in reading order. every
 * section gets a stable id (np-sec-i) so the contents page can point at it
 * and the css can count real page numbers (target-counter).
 */
export function assembleBookBody(input: TypesetBookInput): string {
  const title = escapeHtml(input.title.trim() || "untitled");
  const form = formLine(input.formProfile);
  const out: string[] = [];

  // ---- front matter ----
  out.push(`<section class="np-matter np-half-title"><h1>${title}</h1></section>`);
  out.push(
    `<section class="np-matter np-title-page"><h1>${title}</h1>` +
      (form ? `<p class="np-title-form">${escapeHtml(form)}</p>` : "") +
      `<p class="np-title-press">nova press</p></section>`,
  );
  out.push(
    `<section class="np-matter np-copyright">` +
      `<p>© ${input.year} the author. all rights reserved.</p>` +
      `<p>typeset by nova press.</p></section>`,
  );

  // the contents page lists every titled section, indented by depth. an
  // untitled leaf falls back to its chapter ordinal so the toc never holds a
  // blank line.
  const tocItems: string[] = [];
  let ordinal = 0;
  for (let i = 0; i < input.sections.length; i += 1) {
    const s = input.sections[i]!;
    if (s.isLeaf) ordinal += 1;
    const label = s.title.trim() || (s.isLeaf ? chapterFallback(ordinal) : "");
    if (!label) continue;
    const depth = Math.max(0, Math.min(3, s.depth));
    tocItems.push(
      `<li class="np-toc-depth-${depth}"><a href="#np-sec-${i}">${escapeHtml(label)}</a></li>`,
    );
  }
  if (tocItems.length > 0) {
    out.push(
      `<section class="np-matter np-contents"><h2>contents</h2><ol>${tocItems.join("")}</ol></section>`,
    );
  }

  // ---- the body ----
  ordinal = 0;
  for (let i = 0; i < input.sections.length; i += 1) {
    const s = input.sections[i]!;
    if (!s.isLeaf) {
      out.push(
        `<section class="np-part" id="np-sec-${i}">` +
          `<h2 class="np-part-title">${escapeHtml(s.title.trim() || "part")}</h2></section>`,
      );
      continue;
    }
    ordinal += 1;
    const label = s.title.trim() || chapterFallback(ordinal);
    out.push(
      `<section class="np-chapter" id="np-sec-${i}">` +
        `<h2 class="np-chapter-title">${escapeHtml(label)}</h2>` +
        `<div class="np-chapter-body">${s.html || "<p></p>"}</div></section>`,
    );
  }

  // ---- back matter ----
  out.push(
    `<section class="np-matter np-colophon">` +
      `<p>set in ibm plex serif ... quotes curled, the rag hyphenated, widows guarded.</p>` +
      `<p>typeset by nova press · ${input.year}</p></section>`,
  );

  return out.join("\n");
}

/** wrap a body + stylesheet into the complete standalone document pagedjs
 *  renders. the style block is injected AFTER the typography pass ran on the
 *  body, so the pass can never touch a css string. */
export function bookDocument(opts: { title: string; css: string; bodyHtml: string }): string {
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/>` +
    `<title>${escapeHtml(opts.title)}</title>` +
    `<style>${opts.css}</style></head><body>${opts.bodyHtml}</body></html>`
  );
}

/**
 * the one-call composition the route uses: assemble the matter + sections,
 * run the print typography pass over the whole body (titles + prose alike),
 * and wrap it with the page masters. still pure ... the caller passes the
 * year and hands the string to the renderer.
 */
export function composeBookHtml(input: TypesetBookInput, model: PageModel = TRADE_PAGE): string {
  const body = typesetHtml(assembleBookBody(input));
  // the running head + the document title get the same smarten pass the body
  // gets, so a quote in the title curls the same way everywhere it prints.
  const title = smartenPlain(input.title.trim() || "untitled");
  const css = bookCss(model, { runningTitle: title });
  return bookDocument({ title, css, bodyHtml: body });
}
