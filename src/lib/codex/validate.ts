// pure validation + normalization for a bible entity the codex edits. no db /
// server imports, so it's unit-tested headless and the codex db layer (codex.ts)
// just runs a draft through normalizeEntity before a write: a name is trimmed,
// the kind is a real one, the summary / aliases / facts are de-duped + bounded
// (the same MAX_FIELD discipline composeBible uses, so a fat paste can't blow a
// row or, downstream, the author prompt's bible slot).

export const ENTITY_KINDS = ["character", "place", "object", "faction", "event", "lore"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export function isEntityKind(s: unknown): s is EntityKind {
  return typeof s === "string" && (ENTITY_KINDS as readonly string[]).includes(s);
}

// the loose shape the UI / server action hands in ... any field could be junk.
export interface EntityDraft {
  name?: unknown;
  kind?: unknown;
  summary?: unknown;
  aliases?: unknown;
  facts?: unknown;
}

// the clean shape a write uses.
export interface NormalizedEntity {
  name: string;
  kind: EntityKind;
  summary: string | null;
  aliases: string[];
  facts: string[];
}

// the entry stays a reference, not a manuscript: cap the name, the summary, each
// alias / fact, and the breadth of the lists, deterministically.
const MAX_NAME = 120;
const MAX_SUMMARY = 600;
const MAX_ALIAS = 120;
const MAX_FACT = 400;
const MAX_ALIASES = 24;
const MAX_FACTS = 40;

function clean(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

// split a list field into clean, de-duped, bounded items. accepts an array (the
// UI may send one) or a newline / comma blob (a textarea). the de-dupe is
// case-insensitive and keeps the first spelling; blanks drop. an item whose lower
// form is in `exclude` is skipped BEFORE the count cap, so a dropped self-alias
// never eats a real alias slot.
function cleanList(
  input: unknown,
  maxItem: number,
  maxCount: number,
  exclude?: ReadonlySet<string>,
): string[] {
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
    if (exclude && exclude.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= maxCount) break;
  }
  return out;
}

export interface ValidationResult {
  ok: boolean;
  entity?: NormalizedEntity;
  error?: string;
}

/**
 * validate + normalize a draft into a writable entity, or a calm lowercase reason
 * it can't be written. the name + the kind are the only hard requirements; the
 * summary / aliases / facts are optional and bounded. an alias equal to the name
 * (case-insensitive) is dropped ... composeBible drops it too, so don't store it.
 */
export function normalizeEntity(draft: EntityDraft): ValidationResult {
  const name = clean(draft.name, MAX_NAME);
  if (!name) return { ok: false, error: "a codex entry needs a name." };
  if (!isEntityKind(draft.kind)) {
    return { ok: false, error: "pick what kind of thing this is." };
  }

  const summary = clean(draft.summary, MAX_SUMMARY);
  // drop the self-alias BEFORE the breadth cap, so an entity listing its own name
  // among its aliases never costs a real alias a slot. composeBible drops a
  // self-alias too, so it would never reach the prompt anyway.
  const aliases = cleanList(draft.aliases, MAX_ALIAS, MAX_ALIASES, new Set([name.toLowerCase()]));
  const facts = cleanList(draft.facts, MAX_FACT, MAX_FACTS);

  return {
    ok: true,
    entity: { name, kind: draft.kind, summary: summary || null, aliases, facts },
  };
}
