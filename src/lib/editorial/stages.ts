// nova press · the mythos · the editorial ladder (pure state machine).
//
// the craft axis is forward-gated + backward-free: you advance one stage at a
// time (a gate you must pass), but you can drop back to any earlier stage for
// nothing (a copy-edit reveals a structural hole; you fall back to
// developmental). a work has no stage of its own ... it is only as finished as
// its least-advanced piece, so its stage is the min over its pieces.
//
// no server-only, no db, no react ... just the ordering + the transition rules,
// unit-tested like voice-stats.ts. the db advance-gate (v0_8_0 / phase 2.3) and
// the lenses (phase 2.2) build on this.

import type { EditorialStage } from "@/types/editorial";

/** the ladder, in order. index IS the rank. */
export const STAGES: readonly EditorialStage[] = [
  "drafting",
  "developmental",
  "line",
  "copy",
  "proof",
  "typeset",
  "exported",
] as const;

const RANK: ReadonlyMap<EditorialStage, number> = new Map(STAGES.map((s, i) => [s, i]));

/** is this string a real stage? (the db CHECK + the runtime guard.) */
export function isEditorialStage(value: unknown): value is EditorialStage {
  return typeof value === "string" && RANK.has(value as EditorialStage);
}

/** the ladder rank (0 = drafting). an unknown stage ranks as drafting (0), the
 *  safest floor ... a corrupt value never reads as "more finished than it is". */
export function stageRank(stage: EditorialStage): number {
  return RANK.get(stage) ?? 0;
}

/** the next stage up the ladder, or null at the top (exported). */
export function nextStage(stage: EditorialStage): EditorialStage | null {
  return STAGES[stageRank(stage) + 1] ?? null;
}

/** the previous stage, or null at the bottom (drafting). */
export function prevStage(stage: EditorialStage): EditorialStage | null {
  const i = stageRank(stage);
  return i > 0 ? (STAGES[i - 1] ?? null) : null;
}

export type Transition = "advance" | "retreat" | "same" | "skip";

/**
 * classify a requested move. forward-gated: only a single step up is an
 * "advance"; jumping two or more stages forward is a "skip" (disallowed, you
 * pass one gate at a time). backward-free: any drop is a "retreat" (allowed).
 */
export function classifyTransition(from: EditorialStage, to: EditorialStage): Transition {
  const a = stageRank(from);
  const b = stageRank(to);
  if (b === a) return "same";
  if (b < a) return "retreat";
  return b === a + 1 ? "advance" : "skip";
}

/** is this move allowed at all? (a skip is the only forbidden move.) */
export function isAllowedTransition(from: EditorialStage, to: EditorialStage): boolean {
  return classifyTransition(from, to) !== "skip";
}

/** a work's stage = the min over its pieces (only as finished as its least
 *  finished chapter). an empty work is at drafting. */
export function workStage(pieceStages: readonly EditorialStage[]): EditorialStage {
  if (pieceStages.length === 0) return "drafting";
  // min by RANK, then return the canonical stage at that rank ... a corrupt
  // member clamps to STAGES[0] = drafting (the floor) rather than leaking out.
  let minRank = stageRank(pieceStages[0]!);
  for (const s of pieceStages) {
    minRank = Math.min(minRank, stageRank(s));
  }
  return STAGES[minRank]!;
}

/**
 * a pass is stale iff the writer has edited the piece past the words the pass
 * reviewed ... source_edited_at < the piece's current last_edited_at. both are
 * iso timestamps; a malformed pair reads as NOT stale (never cry wolf on a parse
 * hiccup). computed on read, never stored (the np_repurpose_outputs rule).
 */
export function isPassStale(sourceEditedAt: string, pieceLastEditedAt: string): boolean {
  const src = Date.parse(sourceEditedAt);
  const last = Date.parse(pieceLastEditedAt);
  if (Number.isNaN(src) || Number.isNaN(last)) return false;
  return src < last;
}
