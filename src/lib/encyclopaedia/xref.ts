// pure cross-reference (xref) parsing + resolution for the encyclopaedia form. an
// author writes [[target]] or [[target|label]] in an article's prose; the reading
// view renders it as a link to the article whose title (headword) matches the
// target, case-insensitively. a literal double-bracket is escaped as \[[ (and the
// reading text unescapes it). no db / server imports, so it's unit-tested headless.

// (?<!\\) ... an escaped \[[ does not open an xref. target is non-empty + holds no
// ] or | ; an optional |label holds no ] ; then ]].
const XREF_RE = /(?<!\\)\[\[([^\]|]+?)(?:\|([^\]]*?))?\]\]/g;

export interface XrefSpan {
  raw: string;
  target: string;
  // the display text ... the label if one was given, else the target.
  label: string;
  start: number;
  end: number;
}

/** every [[xref]] span in the text, in reading order. a blank target is skipped. */
export function parseXrefs(text: string): XrefSpan[] {
  const s = String(text ?? "");
  const out: XrefSpan[] = [];
  XREF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = XREF_RE.exec(s)) !== null) {
    const target = (m[1] ?? "").trim();
    if (!target) continue;
    const label = (m[2] ?? "").trim() || target;
    out.push({ raw: m[0], target, label, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

export type XrefSegment =
  | { kind: "text"; value: string }
  | { kind: "xref"; target: string; label: string };

// turn an escaped \[[ back into a literal [[ for display.
function unescapeBrackets(s: string): string {
  return s.replace(/\\\[\[/g, "[[");
}

/**
 * split a text run into plain-text + xref segments, in order, so the reading view
 * can render each xref as a link and the rest as text. an escaped \[[ stays text
 * (unescaped). empty input yields no segments.
 */
export function splitOnXrefs(text: string): XrefSegment[] {
  const s = String(text ?? "");
  const spans = parseXrefs(s);
  if (spans.length === 0) {
    return s ? [{ kind: "text", value: unescapeBrackets(s) }] : [];
  }
  const out: XrefSegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) {
      out.push({ kind: "text", value: unescapeBrackets(s.slice(cursor, span.start)) });
    }
    out.push({ kind: "xref", target: span.target, label: span.label });
    cursor = span.end;
  }
  if (cursor < s.length) {
    out.push({ kind: "text", value: unescapeBrackets(s.slice(cursor)) });
  }
  return out;
}

export interface XrefTarget {
  id: string;
  title: string;
}

function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * resolve an xref target to an article id by title (headword), case-insensitive +
 * whitespace-normalized. the FIRST match wins (deterministic) when two articles
 * share a title; null when nothing matches (a dangling xref the view renders as
 * plain, broken-link styling).
 */
export function resolveXref(target: string, articles: readonly XrefTarget[]): string | null {
  const key = norm(target);
  if (!key) return null;
  for (const a of articles) {
    if (norm(a.title) === key) return a.id;
  }
  return null;
}
