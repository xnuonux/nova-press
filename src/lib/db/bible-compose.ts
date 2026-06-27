// pure composition of the world bible into the compact reference the author
// prompt reads. no server / db imports, so it's unit-tested headless and the
// server bible reader (bible.ts) just hands it the rows. bounded in breadth,
// depth, and total length so the slot grounds the model rather than flooding it.

/** an entity as the prompt sees it: who/what it is, the names it answers to, and
 *  the established truths about it. */
export interface BibleEntityView {
  name: string;
  kind: string;
  summary: string | null;
  aliases: string[];
  facts: string[];
}

// the bible grounds the model, it doesn't drown it. a long manuscript's bible
// could be hundreds of entries, so cap the breadth + depth + per-field + total
// length, deterministically (the most-recent / canonical order is the caller's).
const MAX_ENTITIES = 24;
const MAX_FACTS = 6;
const MAX_FIELD = 240; // per name / summary / alias / fact ... so one fat entry can't blow the slot
const MAX_CHARS = 2400;

// collapse whitespace AND hard-cap the field ... summary + fact text are
// uncapped in the schema (and 4.2's model writes facts), so without this a
// single long field would land whole in the prompt and MAX_CHARS would only
// count blocks, never bound their size (the sibling document/context slices do
// the same hard cap "so a long manuscript can't run up the token bill").
function cleanLine(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, MAX_FIELD).trim();
}

/**
 * compose the bible entities into the compact reference. one block per entity: a
 * header line ("name (kind) ... summary [also: alias, alias]") then its facts as
 * dashed lines. an alias equal to the name (case-insensitive) is dropped. bounded
 * in breadth, depth, and total length. returns "" when there's nothing recorded.
 */
export function composeBible(entities: readonly BibleEntityView[]): string {
  const blocks: string[] = [];
  let used = 0;

  for (const entity of entities.slice(0, MAX_ENTITIES)) {
    const name = cleanLine(entity.name);
    if (!name) continue;
    const kind = cleanLine(entity.kind) || "entity";
    const summary = cleanLine(entity.summary);
    const aliases = (entity.aliases ?? [])
      .map(cleanLine)
      .filter((a) => a.length > 0 && a.toLowerCase() !== name.toLowerCase());

    let header = `${name} (${kind})`;
    if (summary) header += ` ... ${summary}`;
    if (aliases.length > 0) header += ` [also: ${aliases.join(", ")}]`;

    const factLines = (entity.facts ?? [])
      .map(cleanLine)
      .filter((f) => f.length > 0)
      .slice(0, MAX_FACTS)
      .map((f) => `- ${f}`);

    const block = [header, ...factLines].join("\n");
    // keep at least one block; stop before the slot overflows.
    if (used + block.length + 1 > MAX_CHARS && blocks.length > 0) break;
    blocks.push(block);
    used += block.length + 1;
  }

  return blocks.join("\n");
}
