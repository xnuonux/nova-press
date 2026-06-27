// nova press · the mythos · the editorial advance-gate (pure).
//
// the ladder (src/lib/editorial/stages.ts) says which moves are SHAPED right
// (one step up is an advance, any drop is a free retreat, a jump is a skip).
// this adds the GATE: when a piece may actually take an advance. the rule is
// gentle but firm ... you may climb one rung iff the current stage's review
// pass is current and every FLAG it raised has been triaged (accepted or set
// aside). notes never block (they are observations, not gates). a retreat is
// always free; a stale pass blocks until it is re-run (you have edited past the
// words it reviewed, so its verdict no longer holds).
//
// pure: the db layer (src/lib/db/editorial.ts) resolves the pass + staleness and
// hands them in, so the gate stays unit-tested. the result is descriptive ... a
// reason in nova's voice, never a bare boolean.

import type { EditorialStage, EditorialPass, Finding } from "@/types/editorial";

import { classifyTransition, type Transition } from "./stages";

export interface TransitionContext {
  /** the CURRENT stage's pass (the one gating an advance), or null if none ran. */
  pass?: EditorialPass | null;
  /** whether that pass is stale (the db layer computes it via isPassStale). */
  stale?: boolean;
}

export interface TransitionResult {
  allowed: boolean;
  /** lowercase, in voice ... why the move is or isn't open right now. */
  reason: string;
  transition: Transition;
}

/** the flags a pass still wants a look at: severity flag, status open. notes
 *  (and already-triaged flags) never count ... only an open flag gates. */
export function openFlagCount(findings: readonly Finding[]): number {
  return findings.filter((f) => f.severity === "flag" && f.status === "open").length;
}

/**
 * decide whether a piece at `from` may move to `to`, given the current stage's
 * pass + its staleness. retreats + no-ops are always allowed; a skip never is;
 * an advance is gated on a current, fully-triaged pass.
 */
export function evaluateTransition(
  from: EditorialStage,
  to: EditorialStage,
  ctx: TransitionContext = {},
): TransitionResult {
  const transition = classifyTransition(from, to);

  if (transition === "same") {
    return { allowed: true, reason: "already at this stage.", transition };
  }
  if (transition === "retreat") {
    return { allowed: true, reason: "stepping back is always free.", transition };
  }
  if (transition === "skip") {
    return {
      allowed: false,
      reason: "you advance one stage at a time ... step through each gate in turn.",
      transition,
    };
  }

  // an advance: gated on a current, triaged pass.
  if (!ctx.pass) {
    return {
      allowed: false,
      reason: "this stage hasn't been reviewed yet ... run a pass first.",
      transition,
    };
  }
  if (ctx.stale) {
    return {
      allowed: false,
      reason: "the last pass is stale ... you've written past it, so re-run it first.",
      transition,
    };
  }
  const open = openFlagCount(ctx.pass.findings);
  if (open > 0) {
    return {
      allowed: false,
      reason: `${open} flag${open === 1 ? "" : "s"} still want${open === 1 ? "s" : ""} a look ... accept or set them aside to advance.`,
      transition,
    };
  }
  return { allowed: true, reason: "every flag is triaged ... clear to advance.", transition };
}
