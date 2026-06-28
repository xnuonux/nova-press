// pure citation collection for the encyclopaedia. an author writes ((source text))
// in an article's prose; the reading view gathers them in reading order into
// numbered footnotes, de-duping identical sources to a single number. the syntax is
// double parens, deliberately distinct from the [[xref]] double brackets. no db /
// server imports, so it's unit-tested headless.

const CITE_RE = /\(\(([^)]+?)\)\)/g;

export interface CitedRun {
  // the footnote number this in-text marker carries.
  number: number;
  text: string;
  start: number;
  end: number;
}

export interface Footnote {
  number: number;
  text: string;
}

function norm(s: string): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * gather the ((citations)) in reading order: each in-text marker gets a number, and
 * identical citation text (case-insensitive) shares ONE number + ONE footnote (so
 * the same source cited twice is "[1]" both times). returns the in-text runs (with
 * positions, for the reading split) + the ordered unique footnotes.
 */
export function collectCitations(text: string): { runs: CitedRun[]; footnotes: Footnote[] } {
  const s = String(text ?? "");
  CITE_RE.lastIndex = 0;
  const runs: CitedRun[] = [];
  const footnotes: Footnote[] = [];
  const byText = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = CITE_RE.exec(s)) !== null) {
    const body = norm(m[1] ?? "");
    if (!body) continue;
    const key = body.toLowerCase();
    let number = byText.get(key);
    if (number === undefined) {
      number = footnotes.length + 1;
      byText.set(key, number);
      footnotes.push({ number, text: body });
    }
    runs.push({ number, text: body, start: m.index, end: m.index + m[0].length });
  }
  return { runs, footnotes };
}

export type CiteSegment =
  | { kind: "text"; value: string }
  | { kind: "cite"; number: number; text: string };

/** split a text run into plain-text + citation-marker segments, so the reading view
 *  can render each marker as a small superscript number. */
export function splitOnCitations(text: string): { segments: CiteSegment[]; footnotes: Footnote[] } {
  const s = String(text ?? "");
  const { runs, footnotes } = collectCitations(s);
  if (runs.length === 0) {
    return { segments: s ? [{ kind: "text", value: s }] : [], footnotes };
  }
  const segments: CiteSegment[] = [];
  let cursor = 0;
  for (const run of runs) {
    if (run.start > cursor) segments.push({ kind: "text", value: s.slice(cursor, run.start) });
    segments.push({ kind: "cite", number: run.number, text: run.text });
    cursor = run.end;
  }
  if (cursor < s.length) segments.push({ kind: "text", value: s.slice(cursor) });
  return { segments, footnotes };
}
