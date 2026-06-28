// pure: a continuity flag -> the codex entry it points at. an "unintroduced" flag
// (a recurring proper noun the bible has never met) is exactly a proposal to add
// that noun, so it maps to a pre-filled draft (the name, a default kind, an empty
// summary). a name_drift flag is a MISSPELLING of an entity that already exists,
// not a new one, so it maps to nothing. no db / server imports, unit-tested
// headless; the server enriches the draft with a model-proposed kind / summary.

import type { EntityKind } from "@/lib/codex/validate";

export interface CodexDraft {
  name: string;
  kind: EntityKind;
  summary: string;
}

/** the loose flag shape this reads ... only the kind + the scope.mention matter. */
export interface FlagLike {
  kind: string;
  scope?: Record<string, unknown> | null;
}

/**
 * the pre-filled codex draft an unintroduced flag proposes, or null when the flag
 * isn't a "add this to the bible" kind. the name comes from the flag's recorded
 * mention (its display spelling); the kind defaults to character (the writer
 * re-picks it) and the summary is left for the writer or the model to fill.
 */
export function flagToCodexDraft(flag: FlagLike): CodexDraft | null {
  if (flag.kind !== "unintroduced") return null;
  const raw = flag.scope && typeof flag.scope.mention === "string" ? flag.scope.mention : "";
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return null;
  return { name, kind: "character", summary: "" };
}
