"use server";

import { getPieceStage, getPiecePasses, setStage, triageFinding } from "@/lib/db/editorial";
import { isEditorialStage } from "@/lib/editorial/stages";
import type { TransitionResult } from "@/lib/editorial/state-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Finding, FindingStatus } from "@/types/editorial";

// the only triage states a finding may take. validated at the boundary because a
// server action is a public surface ... a caller outside the typed client could
// hand any string.
const TRIAGE_STATES: readonly FindingStatus[] = ["open", "accepted", "dismissed"];
function isFindingStatus(s: string): s is FindingStatus {
  return (TRIAGE_STATES as readonly string[]).includes(s);
}

// accept / dismiss / re-open one finding in a stage's pass. re-checks the
// session; RLS scopes the write. returns the pass's updated findings so the
// panel can re-render the triage state + re-evaluate the advance gate.
export async function triageFindingAction(
  pieceId: string,
  stage: string,
  index: number,
  status: string,
): Promise<{ ok: boolean; findings: Finding[] }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isEditorialStage(stage) || !isFindingStatus(status)) {
    return { ok: false, findings: [] };
  }
  const pass = await triageFinding(supabase, pieceId, stage, index, status);
  return { ok: true, findings: pass?.findings ?? [] };
}

// the destination stage's stored pass, folded onto the transition result so the
// panel restores a retreat's prior review instead of blanking it. on an advance
// the new stage is fresh (no pass), so it lands empty.
export interface StageMoveResult extends TransitionResult {
  target?: { findings: Finding[]; hasPass: boolean; stale: boolean };
}

// move a piece to a target stage THROUGH the gate (setStage is authoritative ...
// the client gate is only a hint). returns the descriptive result; a blocked
// move writes nothing. on an allowed move it also resolves the destination
// stage's pass so a retreat restores its findings rather than discarding them.
export async function setStageAction(pieceId: string, target: string): Promise<StageMoveResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { allowed: false, reason: "you're not signed in.", transition: "skip" };
  }
  if (!isEditorialStage(target)) {
    return { allowed: false, reason: "that isn't a real stage.", transition: "skip" };
  }

  // resolve the piece up front so a missing / unreadable id is a calm reason,
  // never a thrown 500 out of setStage's not-found path.
  const current = await getPieceStage(supabase, pieceId);
  if (!current) {
    return { allowed: false, reason: "couldn't find that piece.", transition: "skip" };
  }

  const result = await setStage(supabase, pieceId, target);
  if (!result.allowed) {
    return result;
  }

  // the move landed: hand back the destination stage's stored pass (with
  // read-time staleness) so the panel shows the right state without a reload.
  const passes = await getPiecePasses(supabase, pieceId);
  const landed = passes.find((p) => p.pass.stage === target);
  return {
    ...result,
    target: {
      findings: landed?.pass.findings ?? [],
      hasPass: !!landed,
      stale: landed?.stale ?? false,
    },
  };
}
