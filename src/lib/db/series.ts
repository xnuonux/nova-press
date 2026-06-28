import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { descendantIds, wouldCycle, type SeriesNode } from "@/lib/works/series";

// the series db layer ... a Work-of-Works. a work joins a series by pointing
// parent_work_id at another work AND sharing that branch's codex via
// bible_work_id, so the whole series reads one bible. the cycle guard runs over
// the user's flat work list (pure helpers in works/series.ts). RLS scopes every
// read + write to the owner. reads never throw.

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

export interface SeriesWork {
  id: string;
  title: string;
  parentWorkId: string | null;
}

/** the user's works as series nodes (id + title + parent), for the cycle guard +
 *  the parent picker. RLS owner-scoped, archived hidden. never throws ... a
 *  degraded read yields []. */
export async function listSeriesWorks(client: ServerClient): Promise<SeriesWork[]> {
  const typed = client as unknown as TypedClient;
  try {
    const { data, error } = await typed
      .from("np_works")
      .select("id, title, parent_work_id, status")
      .neq("status", "archived")
      .order("updated_at", { ascending: false });
    if (error || !data) return [];
    return data.map((r) => ({ id: r.id, title: r.title, parentWorkId: r.parent_work_id }));
  } catch {
    return [];
  }
}

export type SeriesResult = { ok: true } | { ok: false; error: string };

/**
 * attach workId under parentId (joining its series + sharing its branch's codex)
 * or detach it (parentId null ... the work owns its own bible again). validates
 * against a cycle using the user's flat work list. the branch's effective bible is
 * the parent's (its bible_work_id ?? the parent itself), so a three-deep series
 * still resolves to one codex; on a detach the work becomes its own bible owner.
 *
 * re-pointing carries the WHOLE branch: workId AND its descendants get the new
 * effective bible, so re-parenting an interior volume never strands its children
 * on a stale codex. RLS scopes every write.
 */
export async function setWorkParent(
  client: ServerClient,
  workId: string,
  parentId: string | null,
): Promise<SeriesResult> {
  const typed = client as unknown as TypedClient;
  const works = await listSeriesWorks(client);
  const nodes: SeriesNode[] = works.map((w) => ({ id: w.id, parentWorkId: w.parentWorkId }));

  if (!nodes.some((n) => n.id === workId)) {
    return { ok: false, error: "couldn't find that work." };
  }
  if (parentId) {
    if (!nodes.some((n) => n.id === parentId)) {
      return { ok: false, error: "couldn't find that series." };
    }
    if (wouldCycle(nodes, workId, parentId)) {
      return { ok: false, error: "a work can't sit inside its own series branch." };
    }
  }

  // the bible the branch should read after the change.
  let branchBible: string;
  if (parentId) {
    const { data: parent } = await typed
      .from("np_works")
      .select("bible_work_id")
      .eq("id", parentId)
      .maybeSingle();
    branchBible = (parent?.bible_work_id as string | null) ?? parentId;
  } else {
    // detached: the work owns its own codex (stored as null on itself; its
    // descendants point AT it).
    branchBible = workId;
  }

  // carry the whole branch to the new codex FIRST, then re-point this work LAST.
  // this work's parent_work_id is the branch-defining write, so making it the
  // commit point means an interrupted run never leaves this work claiming a new
  // parent while a descendant still reads the old codex. the two writes aren't a
  // single transaction (PostgREST has none here), but a retry is idempotent:
  // descendantIds is computed from the UNTOUCHED parent pointers, so it recomputes
  // the same branch and re-applies the same bible.
  const descendants = [...descendantIds(nodes, workId)];
  if (descendants.length > 0) {
    const { error: descErr } = await typed
      .from("np_works")
      .update({ bible_work_id: branchBible })
      .in("id", descendants);
    if (descErr) {
      return { ok: false, error: "couldn't update the series branch." };
    }
  }

  const { data, error } = await typed
    .from("np_works")
    .update({ parent_work_id: parentId, bible_work_id: parentId ? branchBible : null })
    .eq("id", workId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "couldn't update that work." };
  }

  return { ok: true };
}
