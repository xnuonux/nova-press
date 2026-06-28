// pure render-merge for an article's text: weave the [[xref]] spans and the
// ((cite)) spans into ONE ordered segment list, with the citations numbered
// globally across the text so the footnotes stay stable. the reading view walks the
// segments ... text as text, an xref as a (resolved) link, a cite as a superscript
// number. no db / server imports, unit-tested headless.

import { collectCitations, type Footnote } from "./citations";
import { parseXrefs } from "./xref";

export type ArticleSegment =
  | { kind: "text"; value: string }
  | { kind: "xref"; target: string; label: string }
  | { kind: "cite"; number: number; text: string };

function unescapeBrackets(s: string): string {
  return s.replace(/\\\[\[/g, "[[");
}

// blank out the given [start,end) ranges with spaces, preserving total length and
// every char position OUTSIDE the ranges. used to hide the xref spans from the
// citation scan: a ((cite)) that sits inside or straddles an [[xref]] then never
// matches, so it's never numbered ... no orphan footnote, no numbering gap. slice
// + repeat (not a char array) so no surrogate pair is ever split.
function maskSpans(s: string, spans: readonly { start: number; end: number }[]): string {
  if (spans.length === 0) return s;
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const sp of sorted) {
    const start = Math.max(cursor, sp.start);
    const end = Math.max(start, sp.end);
    if (start > cursor) out += s.slice(cursor, start);
    out += " ".repeat(end - start);
    cursor = Math.max(cursor, end);
  }
  if (cursor < s.length) out += s.slice(cursor);
  return out;
}

export function segmentArticle(text: string): {
  segments: ArticleSegment[];
  footnotes: Footnote[];
} {
  const s = String(text ?? "");
  const xrefs = parseXrefs(s);
  // collect the citations over a copy with the xref ranges masked, so only the
  // cites that survive (the ones the merge can actually show in-text) get a number
  // and a footnote. masking keeps every surviving cite's index valid against `s`.
  const { runs, footnotes } = collectCitations(maskSpans(s, xrefs));

  const spans: { start: number; end: number; seg: ArticleSegment }[] = [
    ...xrefs.map((x) => ({
      start: x.start,
      end: x.end,
      seg: { kind: "xref" as const, target: x.target, label: x.label },
    })),
    ...runs.map((r) => ({
      start: r.start,
      end: r.end,
      seg: { kind: "cite" as const, number: r.number, text: r.text },
    })),
  ].sort((a, b) => a.start - b.start);

  const out: ArticleSegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    // xref + surviving-cite spans are disjoint by construction (the masking dropped
    // any cite overlapping an xref); this guard is belt-and-braces.
    if (span.start < cursor) continue;
    if (span.start > cursor) {
      out.push({ kind: "text", value: unescapeBrackets(s.slice(cursor, span.start)) });
    }
    out.push(span.seg);
    cursor = span.end;
  }
  if (cursor < s.length) {
    out.push({ kind: "text", value: unescapeBrackets(s.slice(cursor)) });
  }
  return { segments: out, footnotes };
}
