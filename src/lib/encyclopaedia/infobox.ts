// pure infobox record shape for the encyclopaedia (the form registry's
// INFOBOX_SCHEMA): a title (headword), the names it's also known as, a
// classification, a summary, and a list of attributes. it maps to / from the
// np_nodes.record jsonb an article carries alongside its prose piece. no db /
// server imports, unit-tested headless.

export interface InfoboxView {
  title: string;
  aka: string[];
  classification: string;
  summary: string;
  attributes: string[];
}

export interface InfoboxDraft {
  title?: unknown;
  aka?: unknown;
  classification?: unknown;
  summary?: unknown;
  attributes?: unknown;
}

const MAX_TITLE = 120;
const MAX_LINE = 200;
const MAX_SUMMARY = 1200;
const MAX_LIST = 24;

function clean(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

function cleanList(input: unknown, maxItem: number, maxCount: number): string[] {
  let raw: unknown[];
  if (Array.isArray(input)) raw = input;
  else if (typeof input === "string") raw = input.split(/[\n,]/);
  else return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const v = clean(item, maxItem);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= maxCount) break;
  }
  return out;
}

export interface InfoboxResult {
  ok: boolean;
  infobox?: InfoboxView;
  error?: string;
}

/** validate + normalize a draft into a writable infobox, or a calm reason. the
 *  title is the only hard requirement (it's the article's name + the xref target);
 *  the rest are optional + bounded. an aka equal to the title is dropped. */
export function normalizeInfobox(draft: InfoboxDraft): InfoboxResult {
  const title = clean(draft.title, MAX_TITLE);
  if (!title) return { ok: false, error: "an article needs a title." };
  const aka = cleanList(draft.aka, MAX_LINE, MAX_LIST).filter(
    (a) => a.toLowerCase() !== title.toLowerCase(),
  );
  return {
    ok: true,
    infobox: {
      title,
      aka,
      classification: clean(draft.classification, MAX_LINE),
      summary: clean(draft.summary, MAX_SUMMARY),
      attributes: cleanList(draft.attributes, MAX_LINE, MAX_LIST),
    },
  };
}

/** the np_nodes.record jsonb an article's infobox is stored as. the title rides
 *  `headword` (the INFOBOX_SCHEMA key), so the headword index + the xref resolve
 *  read the same field. */
export function infoboxToRecord(v: InfoboxView): Record<string, unknown> {
  return {
    headword: v.title,
    aka: v.aka,
    classification: v.classification,
    summary: v.summary,
    attributes: v.attributes,
  };
}

/** read a stored record back into the view (tolerant of partial / legacy rows). */
export function recordToInfobox(record: Record<string, unknown> | null | undefined): InfoboxView {
  const rec = record ?? {};
  return {
    title: clean(rec.headword ?? rec.title, MAX_TITLE),
    aka: cleanList(rec.aka, MAX_LINE, MAX_LIST),
    classification: clean(rec.classification, MAX_LINE),
    summary: clean(rec.summary, MAX_SUMMARY),
    attributes: cleanList(rec.attributes, MAX_LINE, MAX_LIST),
  };
}
