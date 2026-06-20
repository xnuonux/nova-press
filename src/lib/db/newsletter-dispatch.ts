import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

// the writer's own session client throughout ... a dispatch + its log rows are
// owned by the writer (RLS auth.uid()=user_id), never service-role.
type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

export interface PrepareResult {
  alreadySent: boolean;
  completedAt?: string | null;
  sentCount?: number;
  sendToken?: string;
  dispatchId?: string;
}

/**
 * ensure a dispatch row for this exact edition (piece_id, body_hash) and return
 * the server-minted send_token the commit step requires. re-previewing the same
 * edition returns the SAME row (and token); a 'complete' row reports alreadySent
 * so the writer sees "sent on <date>" instead of re-blasting. an edited body is a
 * different hash = a new row = a legitimate re-send.
 */
export async function prepareDispatch(
  client: ServerClient,
  input: { userId: string; pieceId: string; bodyHash: string; subject: string },
): Promise<PrepareResult | null> {
  const typed = client as unknown as TypedClient;

  const existing = await readByEdition(typed, input.pieceId, input.bodyHash);
  if (existing) return existing;

  const { data: inserted, error } = await typed
    .from("np_newsletter_dispatch")
    .insert({
      user_id: input.userId,
      piece_id: input.pieceId,
      body_hash: input.bodyHash,
      subject: input.subject,
      status: "preview",
    })
    .select("id, send_token")
    .single();

  if (error || !inserted) {
    // a concurrent preview won the race on the unique (piece_id, body_hash).
    const raced = await readByEdition(typed, input.pieceId, input.bodyHash);
    return raced;
  }
  return { alreadySent: false, sendToken: inserted.send_token, dispatchId: inserted.id };
}

async function readByEdition(
  typed: TypedClient,
  pieceId: string,
  bodyHash: string,
): Promise<PrepareResult | null> {
  const { data } = await typed
    .from("np_newsletter_dispatch")
    .select("id, status, send_token, sent_count, completed_at")
    .eq("piece_id", pieceId)
    .eq("body_hash", bodyHash)
    .maybeSingle();
  if (!data) return null;
  if (data.status === "complete") {
    return { alreadySent: true, completedAt: data.completed_at, sentCount: data.sent_count };
  }
  return { alreadySent: false, sendToken: data.send_token, dispatchId: data.id };
}

export interface ClaimedDispatch {
  id: string;
  pieceId: string;
  bodyHash: string;
  subject: string;
}

/**
 * the commit step's gate: look up the dispatch by its server-minted token (and
 * owner), and move it preview -> in_progress. a 'complete' row is reported as
 * such (already sent, no re-blast); a missing token is notfound. no caller can
 * reach the send without a token minted by a prepare the writer triggered.
 */
export async function claimDispatch(
  client: ServerClient,
  input: { userId: string; sendToken: string },
): Promise<{ status: "claimed" | "complete" | "notfound"; dispatch?: ClaimedDispatch }> {
  const typed = client as unknown as TypedClient;
  const { data: row } = await typed
    .from("np_newsletter_dispatch")
    .select("id, piece_id, body_hash, subject, status")
    .eq("send_token", input.sendToken)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!row) return { status: "notfound" };
  if (row.status === "complete") return { status: "complete" };

  await typed.from("np_newsletter_dispatch").update({ status: "in_progress" }).eq("id", row.id);
  return {
    status: "claimed",
    dispatch: { id: row.id, pieceId: row.piece_id, bodyHash: row.body_hash, subject: row.subject },
  };
}

/**
 * per-recipient idempotency: attempt to CLAIM a recipient by inserting a
 * 'queued' np_email_log row. the partial unique (dispatch_id, lower(to_email))
 * means a 23505 is "already reached" -> claimed:false -> skip. ANY insert
 * failure also skips (never send what we couldn't record). the email MUST be
 * lowercased by the caller so the later settle matches.
 */
export async function claimRecipient(
  client: ServerClient,
  input: {
    dispatchId: string;
    userId: string;
    subscriberId?: string | null;
    pieceId?: string | null;
    email: string;
    subject?: string | null;
  },
): Promise<{ claimed: boolean }> {
  const typed = client as unknown as TypedClient;
  const { error } = await typed.from("np_email_log").insert({
    user_id: input.userId,
    dispatch_id: input.dispatchId,
    subscriber_id: input.subscriberId ?? null,
    piece_id: input.pieceId ?? null,
    kind: "newsletter",
    to_email: input.email,
    subject: input.subject ?? null,
    status: "queued",
  });
  return { claimed: !error };
}

/** settle a claimed recipient's log row to its final state after the send. */
export async function settleRecipient(
  client: ServerClient,
  input: {
    dispatchId: string;
    email: string;
    status: "sent" | "stubbed" | "failed";
    providerId?: string | null;
    error?: string | null;
  },
): Promise<void> {
  const typed = client as unknown as TypedClient;
  await typed
    .from("np_email_log")
    .update({
      status: input.status,
      provider_id: input.providerId ?? null,
      error: input.error ?? null,
    })
    .eq("dispatch_id", input.dispatchId)
    .eq("to_email", input.email);
}

/** close the dispatch with the SETTLED counts (sent = delivered, not attempted). */
export async function completeDispatch(
  client: ServerClient,
  input: { dispatchId: string; attemptedCount: number; sentCount: number; failedCount: number },
): Promise<void> {
  const typed = client as unknown as TypedClient;
  await typed
    .from("np_newsletter_dispatch")
    .update({
      status: "complete",
      attempted_count: input.attemptedCount,
      sent_count: input.sentCount,
      failed_count: input.failedCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.dispatchId);
}
