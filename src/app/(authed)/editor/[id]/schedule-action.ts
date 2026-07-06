"use server";

import { schedulePiece, cancelSchedule } from "@/lib/db/scheduled";
import { parseScheduleInput } from "@/lib/publish/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ScheduleResult =
  | { ok: true; scheduledAt: string | null }
  | { ok: false; error: string };

// server action behind the editor's "later ..." affordance. when is an iso
// timestamp to schedule, or null to cancel back to draft. mirrors the publish
// action's honesty: re-checks the session, returns the outcome (never throws)
// so the real reason survives prod error redaction.
export async function schedulePieceAction(
  pieceId: string,
  when: string | null,
): Promise<ScheduleResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "you're not signed in" };
  }

  try {
    if (when === null) {
      await cancelSchedule(supabase, pieceId);
      return { ok: true, scheduledAt: null };
    }
    const check = parseScheduleInput(when, new Date().toISOString());
    if (!check.ok) {
      return { ok: false, error: check.error };
    }
    const { scheduledAt } = await schedulePiece(supabase, pieceId, check.whenIso);
    return { ok: true, scheduledAt };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "couldn't schedule this one",
    };
  }
}
