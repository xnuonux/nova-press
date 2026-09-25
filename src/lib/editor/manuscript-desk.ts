/** private, read-only manuscript tools ... never an editor or a save transport. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type RecordValue = { readonly [key: string]: Json };
export type Point = { path: number[]; offset: number };
export type TextRange = { anchor: Point; focus: Point };
export type Draft = Readonly<{
  pieceId: string;
  title: string;
  body: readonly Json[];
  source: string;
  bytes: number;
}>;
export const MAX_DRAFT_BYTES = 2 * 1024 * 1024;
const MAX_ITEMS = 40_000;
const encoder = new TextEncoder();

export function record(value: Json): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** reject non-json values rather than dropping unknown or special-key data. */
export function captureDraft(pieceId: string, title: string, body: unknown): Draft {
  if (typeof pieceId !== "string" || !pieceId || pieceId.length > 200 || typeof title !== "string" || title.length > 20_000) {
    throw new Error("this draft's identity or title is not supported by the desk");
  }
  if (!Array.isArray(body)) throw new Error("the desk needs a document array");
  let items = 0;
  let characters = title.length;
  const ancestors = new WeakSet<object>();
  const clone = (value: unknown, depth: number): Json => {
    if (++items > MAX_ITEMS || depth > 64) throw new Error("this draft is too complex for the desk");
    if (typeof value === "string") {
      characters += value.length;
      if (characters > MAX_DRAFT_BYTES) throw new Error("this draft is too large for the desk");
      return value;
    }
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return value;
    if (typeof value !== "object" || value === null) throw new Error("the draft contains non-json data");
    if (ancestors.has(value)) throw new Error("the draft contains a cycle");
    const isArray = Array.isArray(value);
    const proto = Object.getPrototypeOf(value);
    if (!isArray && proto !== Object.prototype && proto !== null) {
      throw new Error("the draft contains a non-json object");
    }
    ancestors.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some((key) => typeof key !== "string")) throw new Error("the draft contains symbol data");
    if (isArray) {
      // sparse arrays and custom array properties cannot make a lossless json copy.
      if (keys.length !== value.length + 1) throw new Error("the draft contains an irregular array");
      const result: Json[] = [];
      for (let i = 0; i < value.length; i++) {
        const descriptor = descriptors[String(i)];
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
          throw new Error("the draft contains an irregular array");
        }
        result.push(clone(descriptor.value, depth + 1));
      }
      ancestors.delete(value);
      return Object.freeze(result);
    }
    const result: Record<string, Json> = Object.create(null);
    for (const key of Object.keys(descriptors)) {
      const descriptor = descriptors[key];
      if (!("value" in descriptor) || !descriptor.enumerable) {
        throw new Error("the draft contains accessor or hidden data");
      }
      characters += key.length;
      if (characters > MAX_DRAFT_BYTES) throw new Error("this draft is too large for the desk");
      Object.defineProperty(result, key, {
        value: clone(descriptor.value, depth + 1), enumerable: true,
      });
    }
    ancestors.delete(value);
    return Object.freeze(result);
  };
  const cloned = clone(body, 0) as readonly Json[];
  if (!cloned.every(record)) throw new Error("the document has an invalid root block");
  const source = JSON.stringify({ pieceId, title, body: cloned });
  const bytes = encoder.encode(source).byteLength;
  if (bytes > MAX_DRAFT_BYTES) throw new Error("this draft is too large for the desk");
  return Object.freeze({ pieceId, title, body: cloned, source, bytes });
}

export type Run = Readonly<{ path: number[]; start: number; end: number }>;
export type Block = Readonly<{
  index: number; type: string; text: string; runs: readonly Run[]; readable: boolean;
}>;
export function indexDraft(draft: Draft): readonly Block[] {
  return draft.body.map((root, index) => {
    let text = "";
    let readable = true;
    const runs: Run[] = [];
    const walk = (node: Json, path: number[]) => {
      if (!record(node)) { readable = false; return; }
      if (typeof node.text === "string" && !Array.isArray(node.children)) {
        runs.push({ path, start: text.length, end: text.length + node.text.length });
        text += node.text;
      } else if (Array.isArray(node.children) && typeof node.text !== "string") {
        node.children.forEach((child, i) => walk(child, [...path, i]));
      } else { readable = false; }
    };
    walk(root, [index]);
    return { index, type: record(root) && typeof root.type === "string" ? root.type : "unknown", text, runs, readable };
  });
}

export function draftText(draft: Draft): string {
  const blocks = indexDraft(draft);
  return blocks.map((block, i) => {
    const separator = i === 0 ? "" : block.type === "verse_line" && blocks[i - 1].type === "verse_line" ? "\n" : "\n\n";
    return separator + block.text;
  }).join("");
}

function pointAt(block: Block, offset: number, end: boolean): Point | null {
  const run = end
    ? block.runs.find((r) => r.start < offset && offset <= r.end)
    : block.runs.find((r) => r.start <= offset && offset < r.end);
  return run ? { path: [...run.path], offset: offset - run.start } : null;
}
export function outline(draft: Draft) {
  return indexDraft(draft).filter((b) => /^h[1-6]$/.test(b.type)).map((b) => ({
    blockIndex: b.index, level: Number(b.type[1]), title: b.text,
    point: b.runs[0] ? { path: [...b.runs[0].path], offset: 0 } : null,
  }));
}
export type Match = Readonly<{ blockIndex: number; start: number; end: number; range: TextRange; excerpt: string }>;
/** literal, within-block search; unicode regex preserves the original utf-16 offsets. */
export function findPassages(draft: Draft, query: string, caseSensitive = false) {
  if (query.length > 256) throw new Error("search is limited to 256 characters");
  const matches: Match[] = [];
  if (!query) return { matches, more: false };
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, caseSensitive ? "gu" : "giu");
  for (const block of indexDraft(draft)) {
    if (!block.readable) continue;
    for (const found of block.text.matchAll(pattern)) {
      if (matches.length === 200) return { matches, more: true };
      const start = found.index;
      const end = start + found[0].length;
      const anchor = pointAt(block, start, false);
      const focus = pointAt(block, end, true);
      if (anchor && focus) matches.push({
        blockIndex: block.index, start, end, range: { anchor, focus },
        excerpt: block.text.slice(Math.max(0, start - 36), Math.min(block.text.length, end + 64)),
      });
    }
  }
  return { matches, more: false };
}

export type Checkpoint = Readonly<{ id: string; label: string; createdAt: string; draft: Draft }>;
/** memory only; refuses overflow rather than silently evicting the writer's checkpoints. */
export function createCheckpoints(pieceId: string) {
  let sequence = 0;
  let entries: readonly Checkpoint[] = Object.freeze([]);
  return {
    list: () => entries,
    keep(draft: Draft, label: string, createdAt: string): Checkpoint {
      if (draft.pieceId !== pieceId) throw new Error("this checkpoint belongs to another piece");
      if (!label.trim() || label.length > 80) throw new Error("name this checkpoint in 1 to 80 characters");
      if (!Number.isFinite(Date.parse(createdAt))) throw new Error("this checkpoint needs a valid date");
      const duplicate = entries.find((entry) => entry.draft.source === draft.source);
      if (duplicate) return duplicate;
      if (entries.length >= 12 || entries.reduce((sum, entry) => sum + entry.draft.bytes, draft.bytes) > 8 * 1024 * 1024) {
        throw new Error("the checkpoint shelf is full ... export and remove one before keeping another");
      }
      const checkpoint = Object.freeze({ id: String(++sequence), label: label.trim(), createdAt, draft });
      entries = Object.freeze([checkpoint, ...entries]);
      return checkpoint;
    },
    remove(id: string) { entries = Object.freeze(entries.filter((entry) => entry.id !== id)); },
  };
}

/** a linear-time changed window, not a minimal edit script or a quality judgment. */
export function compareDrafts(before: Draft, after: Draft) {
  if (before.pieceId !== after.pieceId) throw new Error("compare checkpoints from the same piece");
  const a = before.body.map((block) => JSON.stringify(block));
  const b = after.body.map((block) => JSON.stringify(block));
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let aEnd = a.length;
  let bEnd = b.length;
  while (aEnd > start && bEnd > start && a[aEnd - 1] === b[bEnd - 1]) { aEnd--; bEnd--; }
  const beforeText = draftText(before);
  const afterText = draftText(after);
  return {
    identical: before.source === after.source,
    titleChanged: before.title !== after.title,
    bodyChanged: aEnd !== start || bEnd !== start,
    formattingOnly: beforeText === afterText && (aEnd !== start || bEnd !== start),
    blockDelta: b.length - a.length,
    start, beforeEnd: aEnd, afterEnd: bEnd,
    beforeText: indexDraft(before).slice(start, aEnd).map((block) => block.text).join("\n\n"),
    afterText: indexDraft(after).slice(start, bEnd).map((block) => block.text).join("\n\n"),
  };
}
