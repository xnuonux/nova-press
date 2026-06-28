// pure prompt + defensive parse for PROPOSING a codex entry's kind + one-line
// summary from the prose, given a name that recurs in it. xray-shaped: the model
// call lives in codex-propose-analyze (server-only) and degrades to {} with no
// model / no key, so the "add to codex" affordance always at least pre-fills the
// name. no db / server imports, unit-tested headless.
//
// it stays a MIRROR: it summarizes what the prose shows about the name, it never
// invents lore or grades the writing. the parse pins the kind to the six real
// ones + bounds + dash-strips the summary (the one model-to-user string here).

import { ENTITY_KINDS, isEntityKind, type EntityKind } from "@/lib/codex/validate";

export interface EntityProposal {
  kind?: EntityKind;
  summary?: string;
}

const MAX_SUMMARY = 200;
const PROSE_CHARS = 4000;

export const CODEX_PROPOSE_SYSTEM = [
  "you read a writer's manuscript and propose a one-line world-bible entry for a NAME that recurs in it ... so the writer can add it to their codex with one tap.",
  `you pick what KIND of thing the name is, from exactly these six: ${ENTITY_KINDS.join(", ")}. a person is a character; a location is a place; a thing is an object; a group is a faction; a happening is an event; a concept / rule / history is lore.`,
  "you write a SUMMARY: one short lowercase line describing what the prose shows this name to be. describe only what the prose actually establishes ... never invent lore the writer hasn't written. no quality words, no advice, no praise. a mirror, never a verdict.",
  "output STRICT JSON ONLY ... no prose, no markdown, no code fences ... exactly this shape:",
  '{"kind": "character", "summary": "the mute ferryman who carries the dead across the seventh gate"}',
  "kind is EXACTLY one of the six. summary is one lowercase sentence, no em-dashes (use ...). if the prose barely mentions the name, give your best read of the kind and a spare summary; never refuse.",
].join("\n\n");

/** the user message: the name to enter + the prose to read it from. the prose is
 *  WINDOWED around the name's first occurrence (an unintroduced noun can recur past
 *  the head of a long manuscript, so a head slice could miss it entirely and push
 *  the model to invent), falling back to the head when the name isn't found. */
export function buildProposePrompt(mention: string, prose: string): string {
  const name = String(mention ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const flat = String(prose ?? "")
    .replace(/\s+/g, " ")
    .trim();

  let text: string;
  const idx = name ? flat.toLowerCase().indexOf(name.toLowerCase()) : -1;
  if (idx >= 0) {
    const half = Math.floor(PROSE_CHARS / 2);
    text = flat.slice(Math.max(0, idx - half), Math.max(0, idx - half) + PROSE_CHARS);
  } else {
    text = flat.slice(0, PROSE_CHARS);
  }

  return `the name to enter into the codex: ${name}\n\nthe prose it appears in:\n${text || "(no prose given)"}`;
}

/**
 * pull the proposed kind + summary out of the model's reply, however it wrapped
 * them, hardened against the model: an unknown kind is dropped (the caller keeps
 * its default), the summary is bounded + dash-stripped (the HARD no-em-dash
 * invariant on the one model-to-user string). a parse failure degrades to {} ...
 * the proposal must never throw.
 */
export function parseProposal(text: string): EntityProposal {
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return {};
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

    const out: EntityProposal = {};
    if (isEntityKind(obj.kind)) out.kind = obj.kind;
    if (typeof obj.summary === "string") {
      const summary = obj.summary
        .replace(/\s+/g, " ")
        .replace(/\s*[—–]\s*/g, " ... ")
        .trim()
        .slice(0, MAX_SUMMARY)
        .trim();
      if (summary) out.summary = summary;
    }
    return out;
  } catch {
    return {};
  }
}
