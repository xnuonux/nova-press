// nova press · the mythos · the print typography pass (the typeset arm).
//
// runs over OUR OWN serialized html (src/lib/io/html.ts output ... a known,
// well-formed, fully-escaped tag set), never the live editor buffer. three
// passes, composed by typesetHtml:
//
//   smartenHtml    ... straight quotes curl with the editor's own direction
//                      rule (open after start / whitespace / an opening
//                      bracket or quote; close otherwise), and a bare
//                      three-dot run becomes a real ellipsis glyph. dashes
//                      are NEVER created ... classic smartypants would emit an
//                      em-dash from "--"; the voice rule forbids them, so
//                      "--" passes through untouched, and a dash a writer
//                      typed themselves is their own word, left alone.
//   hyphenateHtml  ... soft hyphens (u+00ad) from the english tex patterns,
//                      so a justified rag can break inside words instead of
//                      gaping. never inside code, headings, or verse (a
//                      poem's line is the unit; a heading never breaks).
//   widowGuardHtml ... the last inter-word space of a long paragraph becomes
//                      a no-break space, so a lone short word never sits as
//                      the final line on its own.
//
// pure + unit-tested. the canonical slate json and the editor stay untouched
// ... this dresses the export, it never edits the manuscript.

import { hyphenateSync } from "hyphen/en";

import { escapeHtml } from "@/lib/io/html";

// built from char codes, not string literals ... a soft hyphen and a no-break
// space are invisible in source, and an invisible character in code is a trap
// for the next reader. the ellipsis is visible, so its literal is fine.
const SHY = String.fromCharCode(0xad);
const NBSP = String.fromCharCode(0xa0);
const ELLIPSIS = "…";

/** the editor's own curl rule (plate-shell): a quote OPENS when nothing, a
 *  whitespace, an opening bracket, or an already-open quote precedes it. */
const OPENS_AFTER = /[\s([{“‘]/;

type Part = { tag: boolean; value: string };

/** split html into tag parts and text parts. our serializer never emits a
 *  literal "<" in text (everything is escaped), so a simple scan is exact. */
function splitHtml(html: string): Part[] {
  const parts: Part[] = [];
  const re = /<[^>]*>/g;
  let last = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m.index > last) parts.push({ tag: false, value: html.slice(last, m.index) });
    parts.push({ tag: true, value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < html.length) parts.push({ tag: false, value: html.slice(last) });
  return parts;
}

function tagName(tag: string): string {
  const m = /^<\/?\s*([a-z0-9-]+)/i.exec(tag);
  return m ? m[1]!.toLowerCase() : "";
}

function isClosingTag(tag: string): boolean {
  return tag.startsWith("</");
}

/** decode exactly the five entities our escapeHtml produces. &amp; decodes
 *  LAST so a literal "&amp;quot;" in prose round-trips as the text &quot;. */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** the tags that start a fresh line of type ... quote direction never flows
 *  across them (a paragraph break resets the context; an inline mark does
 *  not, so a bold word inside quotes keeps the closing quote closing). */
const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ul",
  "ol",
  "blockquote",
  "div",
  "section",
  "nav",
  "hr",
  "br",
]);

/** hyphenation never reaches into these ... a heading never breaks, and code
 *  is the writer's exact string. verse is handled by class (np-verse). */
const NO_HYPHEN_TAGS = new Set(["code", "h1", "h2", "h3", "h4", "h5", "h6"]);

function smartenText(text: string, prevChar: string): { out: string; prev: string } {
  let out = "";
  let prev = prevChar;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === '"') {
      const curled = prev === "" || OPENS_AFTER.test(prev) ? "“" : "”";
      out += curled;
      prev = curled;
      continue;
    }
    if (ch === "'") {
      const curled = prev === "" || OPENS_AFTER.test(prev) ? "‘" : "’";
      out += curled;
      prev = curled;
      continue;
    }
    // exactly three dots become an ellipsis glyph; a longer run is deliberate
    // punctuation (a hard pause, a fade) and passes through untouched.
    if (
      ch === "." &&
      text[i + 1] === "." &&
      text[i + 2] === "." &&
      text[i + 3] !== "." &&
      prev !== "."
    ) {
      out += ELLIPSIS;
      prev = ELLIPSIS;
      i += 2;
      continue;
    }
    out += ch;
    prev = ch;
  }
  return { out, prev };
}

/** the smarten pass over a PLAIN string (no tags, no entities) ... the running
 *  head and the document title go through this so a quote or a three-dot pause
 *  in a work's title prints the same way it prints in the body. */
export function smartenPlain(text: string): string {
  return smartenText(text, "").out;
}

/** curl straight quotes + turn three-dot runs into a real ellipsis, over the
 *  text runs of serialized html. code spans pass through untouched. never
 *  creates a dash of any kind.
 *
 *  a KNOWN, deliberate limit: the three-dot window reads within one text run,
 *  so an ellipsis split by an inline mark boundary ("wait.." + an italic ".")
 *  stays printed dots. converting it would mean eating characters out of a
 *  DIFFERENT inline element ... restructuring the writer's marks is a worse
 *  trade than three well-kerned dots. pinned by test. */
export function smartenHtml(html: string): string {
  const parts = splitHtml(html);
  let prev = "";
  let codeDepth = 0;
  let out = "";
  for (const part of parts) {
    if (part.tag) {
      const name = tagName(part.value);
      if (name === "code") {
        codeDepth = Math.max(0, codeDepth + (isClosingTag(part.value) ? -1 : 1));
      }
      if (BLOCK_TAGS.has(name)) prev = "";
      out += part.value;
      continue;
    }
    if (codeDepth > 0) {
      // untouched ... but a quote right after inline code should still read
      // as "after a word", so the context char tracks the code text.
      const decoded = decodeEntities(part.value);
      if (decoded.length > 0) prev = decoded[decoded.length - 1]!;
      out += part.value;
      continue;
    }
    const decoded = decodeEntities(part.value);
    const r = smartenText(decoded, prev);
    prev = r.prev;
    out += escapeHtml(r.out);
  }
  return out;
}

/** soft-hyphenate the prose text runs (english tex patterns) so justified
 *  type can break inside a long word. skips code, headings, and verse. */
export function hyphenateHtml(html: string): string {
  const parts = splitHtml(html);
  let skipDepth = 0;
  let verseDepth = 0;
  let out = "";
  for (const part of parts) {
    if (part.tag) {
      const name = tagName(part.value);
      if (NO_HYPHEN_TAGS.has(name)) {
        skipDepth = Math.max(0, skipDepth + (isClosingTag(part.value) ? -1 : 1));
      }
      if (name === "div") {
        // our serializer's verse block is a flat div (no nested divs), so a
        // class check on the open + a matching close is exact for our grammar.
        if (!isClosingTag(part.value) && part.value.includes("np-verse")) verseDepth += 1;
        else if (isClosingTag(part.value) && verseDepth > 0) verseDepth -= 1;
      }
      out += part.value;
      continue;
    }
    if (skipDepth > 0 || verseDepth > 0) {
      out += part.value;
      continue;
    }
    out += escapeHtml(hyphenateSync(decodeEntities(part.value)));
  }
  return out;
}

/** a paragraph must carry at least this many words before its last space is
 *  worth gluing ... a two-word line has no widow to guard. */
const MIN_WIDOW_WORDS = 4;

/** join the last two words of each long paragraph with a no-break space so a
 *  lone word never sits as the paragraph's final line. paragraphs holding
 *  inline code are left alone (a glued space inside code would edit it). */
export function widowGuardHtml(html: string): string {
  const parts = splitHtml(html);
  const out = parts.map((p) => p.value);

  let i = 0;
  while (i < parts.length) {
    const part = parts[i]!;
    if (!part.tag || tagName(part.value) !== "p" || isClosingTag(part.value)) {
      i += 1;
      continue;
    }
    // collect this <p> block's text parts up to its close.
    const textIdx: number[] = [];
    let hasCode = false;
    let j = i + 1;
    for (; j < parts.length; j += 1) {
      const q = parts[j]!;
      if (q.tag) {
        const name = tagName(q.value);
        if (name === "p" && isClosingTag(q.value)) break;
        if (name === "code") hasCode = true;
        continue;
      }
      textIdx.push(j);
    }
    if (!hasCode && textIdx.length > 0) {
      const full = textIdx.map((k) => parts[k]!.value).join("");
      const words = decodeEntities(full).split(/\s+/).filter(Boolean);
      if (words.length >= MIN_WIDOW_WORDS) {
        joinLastSpace(parts, textIdx, out);
      }
    }
    i = j + 1;
  }
  return out.join("");
}

/** find the last whitespace that still has a word after it (across the
 *  block's text parts) and replace that one character with a no-break space.
 *  the SAME whitespace definition as the word-count gate (\s), so a pasted
 *  no-break space or a raw newline is the separator it visibly is: an nbsp
 *  already glues the pair (nothing to do), anything else becomes the glue. */
function joinLastSpace(parts: Part[], textIdx: number[], out: string[]): void {
  let seenWord = false;
  for (let t = textIdx.length - 1; t >= 0; t -= 1) {
    const k = textIdx[t]!;
    const value = parts[k]!.value;
    for (let c = value.length - 1; c >= 0; c -= 1) {
      const ch = value[c]!;
      if (/\s/.test(ch)) {
        if (seenWord) {
          if (ch !== NBSP) {
            out[k] = `${value.slice(0, c)}${NBSP}${value.slice(c + 1)}`;
          }
          return;
        }
      } else {
        seenWord = true;
      }
    }
  }
}

/** the full print pass: curl + ellipse, then soft-hyphenate, then guard the
 *  widows (the no-break join runs last so the hyphen patterns still see the
 *  final two words as separate words). */
export function typesetHtml(html: string): string {
  return widowGuardHtml(hyphenateHtml(smartenHtml(html)));
}

export { NBSP, SHY, ELLIPSIS };
