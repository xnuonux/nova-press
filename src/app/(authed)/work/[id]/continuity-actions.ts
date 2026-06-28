"use server";

import { isContinuityStatus, triageFlag, type ContinuityFlag } from "@/lib/db/continuity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// accept / dismiss / re-open one continuity flag. re-checks the session + validates
// the status at the boundary (a server action is a public surface); RLS + the
// work_id scope in triageFlag do the ownership gating, so a forged flag id from
// another work flips nothing and reads back null. returns the updated flag so the
// rail re-renders its triage state. mirrors the editorial triageFindingAction.
export async function triageContinuityFlagAction(
  workId: string,
  flagId: string,
  status: string,
): Promise<{ ok: boolean; flag: ContinuityFlag | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isContinuityStatus(status)) {
    return { ok: false, flag: null };
  }
  const flag = await triageFlag(supabase, workId, flagId, status);
  return { ok: !!flag, flag };
}
