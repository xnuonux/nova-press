// nova press · the mythos · scheduled publishing (the db arm).
//
// two sides of one promise. the WRITER side (schedulePiece / cancelSchedule)
// runs on the session client, RLS owner-scoped, and mirrors publishPiece's
// honesty: friendly lowercase errors, a null write read as a refusal, never a
// false success. the WORKER side (publishDuePieces) runs on the admin client
// against the partial index (status='scheduled', scheduled_publish_at) and
// NEVER throws ... a sweep is a heartbeat, and one bad row must not stop the
// others: a piece that can no longer publish (emptied since scheduling, a
// stable-slug conflict) is REVERTED to draft so the queue always drains.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { coercePlateValue, plateText } from "@/components/editor/plate-text";
import { isDueForPublish } from "@/lib/publish/schedule";
import { reportError } from "@/lib/observability/report-error";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

import { getPieceById, publishPiece } from "./pieces";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

/** flip a piece to 'scheduled' at a validated future time. the same gates as
 *  publish (owned, real words) plus: a live piece re-publishes, it doesn't
 *  schedule ... two "when does this go out" answers would both be wrong. */
export async function schedulePiece(
  client: ServerClient,
  id: string,
  whenIso: string,
): Promise<{ scheduledAt: string }> {
  const typed = client as unknown as TypedClient;

  const piece = await getPieceById(client, id);
  if (!piece) {
    throw new Error("piece not found");
  }
  if (piece.status === "published") {
    throw new Error("this one's already live ... edit and republish instead");
  }
  if (piece.status === "archived") {
    throw new Error("an archived piece doesn't publish ... restore it first");
  }
  if (!plateText(coercePlateValue(piece.body)).trim()) {
    throw new Error("can't schedule an empty piece ... add some words first");
  }

  const { data, error } = await typed
    .from("np_pieces")
    .update({ status: "scheduled", scheduled_publish_at: whenIso })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`failed to schedule np_pieces row: ${error.message}`);
  }
  if (!data) {
    throw new Error("failed to schedule: piece not found or not owned");
  }
  return { scheduledAt: whenIso };
}

/** walk a scheduled piece back to draft. guarded on status so it can never
 *  un-publish a piece that already went out. */
export async function cancelSchedule(client: ServerClient, id: string): Promise<void> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_pieces")
    .update({ status: "draft", scheduled_publish_at: null })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`failed to cancel schedule: ${error.message}`);
  }
  if (!data) {
    throw new Error("nothing scheduled here ... it may have already published");
  }
}

export interface DueSweepResult {
  /** pieces that went live this sweep. */
  published: string[];
  /** pieces that could no longer publish and were walked back to draft. */
  reverted: string[];
  /** a sweep-level failure note (the list read itself failed), "" when clean. */
  error: string;
}

/**
 * the worker sweep: publish every due scheduled piece. admin client (the
 * writer is asleep ... that's the point), rides the partial index. per-piece
 * failures revert that piece to draft and the sweep continues; the sweep
 * itself never throws.
 *
 * a small honest race is accepted: a writer canceling in the same minute the
 * sweep fires may still get published ... the due-list is a snapshot. the
 * revert guard (status='scheduled') keeps the walk-back from ever touching a
 * row someone else already moved.
 */
export async function publishDuePieces(
  admin: TypedClient,
  nowIso: string,
  max = 25,
): Promise<DueSweepResult> {
  const result: DueSweepResult = { published: [], reverted: [], error: "" };

  const { data, error } = await admin
    .from("np_pieces")
    .select("id, user_id, status, scheduled_publish_at")
    .eq("status", "scheduled")
    .lte("scheduled_publish_at", nowIso)
    .order("scheduled_publish_at", { ascending: true })
    .limit(max);
  if (error) {
    result.error = `due-list read failed: ${error.message}`;
    return result;
  }

  for (const row of data ?? []) {
    // belt over the query's braces ... the pure rule is the one truth of "due".
    if (
      !isDueForPublish({ status: row.status, scheduledPublishAt: row.scheduled_publish_at }, nowIso)
    ) {
      continue;
    }
    try {
      await publishPiece(admin as unknown as ServerClient, row.id);
      result.published.push(row.id);
    } catch (err) {
      reportError(err, { tag: "scheduled-publish-failed", pieceId: row.id, userId: row.user_id });
      const { error: revertError } = await admin
        .from("np_pieces")
        .update({ status: "draft" })
        .eq("id", row.id)
        .eq("status", "scheduled");
      if (revertError) {
        reportError(new Error(`revert failed: ${revertError.message}`), {
          tag: "scheduled-publish-revert-failed",
          pieceId: row.id,
        });
      } else {
        result.reverted.push(row.id);
      }
    }
  }
  return result;
}
