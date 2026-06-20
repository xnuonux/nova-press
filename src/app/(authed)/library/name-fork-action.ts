"use server";

import { revalidatePath } from "next/cache";

import { getActiveWritingFork, setActiveWritingFork } from "@/lib/db/user-settings";
import { listVoiceSnapshots, setSnapshotForkLabel } from "@/lib/db/voice-snapshots";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeForkLabel } from "@/lib/voice/forks";

export type NameForkResult = { ok: boolean };

// server action behind "name this reading / stretch" in the voice timeline. it
// sets fork_label on the writer's OWN snapshot rows ... a pure metadata tag that
// re-colors the timeline + ask and NEVER touches voice_profiles or the live
// writing voice. re-derives the user from the session (never the body), RLS
// double-gates the write, the label is normalized to one canonical strand key,
// and on success it revalidates /library so the unchanged listVoiceSnapshots
// prop re-reads and the new strand surfaces on the next render with no client
// fetch. an empty label un-names (back to "your voice").
export async function nameForkAction(
  snapshotIds: string[],
  rawLabel: string,
): Promise<NameForkResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  if (!Array.isArray(snapshotIds) || snapshotIds.length === 0) return { ok: false };
  const ids = snapshotIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return { ok: false };

  const label = normalizeForkLabel(typeof rawLabel === "string" ? rawLabel : "");
  const result = await setSnapshotForkLabel(supabase, user.id, ids, label);
  if (result.ok) {
    // keep the active writing fork honest: if this naming emptied the strand that
    // was active FOR WRITING (a full rename or un-name moved its last dot), clear
    // the stored pin so the footer + the write source never claim a strand that no
    // longer exists. a PARTIAL re-label leaves the strand intact, so we only clear
    // when listVoiceSnapshots can no longer find a single row carrying that label.
    const active = await getActiveWritingFork(supabase, user.id);
    if (active && (await listVoiceSnapshots(supabase, user.id, 1, active)).length === 0) {
      await setActiveWritingFork(supabase, user.id, null);
    }
    revalidatePath("/library");
  }
  return result;
}
