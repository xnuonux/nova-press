import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Recipient } from "@/lib/email/newsletter";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

// a forgiving but real email check ... we're capturing a reader's address for a
// writer's list, not validating an rfc: one @, something either side, a dot in
// the domain, bounded length (matches the db CHECK).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 320 && EMAIL_RE.test(trimmed);
}

/** PURE: a token must parse as a uuid before any db round-trip ... so a scripted
 * loop of junk tokens is rejected pre-query, not on the database. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// the result of a capture. `sendConfirm` tells the route whether to actually
// send a confirmation email (and `confirmToken` is the token to put in it).
// already-confirmed re-subscribes are an opaque no-op (sendConfirm:false) so the
// response can never reveal that an email is already on a writer's list.
export type SubscribeResult =
  | { ok: true; sendConfirm: boolean; confirmToken: string | null; email: string }
  | { ok: false; error: string };

const SAVE_ERR = "couldn't save that ... try again in a sec";

// (re)start the double opt-in for an existing row: mint a fresh confirm token,
// drop the row back to 'pending', clear any prior confirmation. never flips a
// row straight to 'subscribed' ... a confirm round-trip is always required.
//
// the update is GUARDED with `.neq("status","subscribed")`: in the narrow race
// where the row got confirmed between our read and this write, we must NOT clobber
// the live 'subscribed' state (and its consumed token) back to pending. when the
// guard matches no row, the row is already confirmed ... return the opaque no-op,
// exactly as an already-confirmed capture would.
async function restartOptIn(
  admin: TypedClient,
  id: string,
  email: string,
): Promise<SubscribeResult> {
  const confirmToken = randomUUID();
  const { data, error } = await admin
    .from("np_subscriber")
    .update({ status: "pending", confirm_token: confirmToken, confirmed_at: null })
    .eq("id", id)
    .neq("status", "subscribed")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: SAVE_ERR };
  if (!data) return { ok: true, sendConfirm: false, confirmToken: null, email };
  return { ok: true, sendConfirm: true, confirmToken, email };
}

/**
 * capture an anonymous reader's email for a writer's list, double-opt-in style.
 * service-role (the reader isn't signed in and np_subscriber is RLS owner-only).
 *
 * - no row yet -> insert as 'pending' with a fresh confirm token -> send confirm.
 * - already 'subscribed' (confirmed) -> opaque no-op, NO email (never reveal
 *   membership, never re-mail someone already in).
 * - 'pending' or 'unsubscribed' -> restart the opt-in with a NEW token + resend,
 *   so an unsubscribed reader rejoins only via a fresh confirm, never silently.
 */
export async function addSubscriber(
  admin: TypedClient,
  input: { userId: string; email: string; pieceId?: string | null; slug?: string | null },
): Promise<SubscribeResult> {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "that email doesn't look right" };

  // existing row for this (writer, email)? email is stored lowercased and the
  // unique index is on (user_id, lower(email)), so this is the canonical lookup.
  const { data: existing } = await admin
    .from("np_subscriber")
    .select("id, status")
    .eq("user_id", input.userId)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    if (existing.status === "subscribed") {
      // already confirmed ... opaque success, send nothing.
      return { ok: true, sendConfirm: false, confirmToken: null, email };
    }
    return restartOptIn(admin, existing.id, email);
  }

  const confirmToken = randomUUID();
  const { error } = await admin.from("np_subscriber").insert({
    user_id: input.userId,
    email,
    piece_id: input.pieceId ?? null,
    source_slug: input.slug ?? null,
    status: "pending",
    confirm_token: confirmToken,
  });

  if (error) {
    // 23505 = a concurrent insert won the race between our select and insert.
    // re-read and restart the opt-in on that row rather than failing the reader.
    if (error.code === "23505") {
      const { data: raced } = await admin
        .from("np_subscriber")
        .select("id, status")
        .eq("user_id", input.userId)
        .eq("email", email)
        .maybeSingle();
      if (raced) {
        if (raced.status === "subscribed") {
          return { ok: true, sendConfirm: false, confirmToken: null, email };
        }
        return restartOptIn(admin, raced.id, email);
      }
    }
    return { ok: false, error: SAVE_ERR };
  }
  return { ok: true, sendConfirm: true, confirmToken, email };
}

/**
 * confirm a pending subscription. service-role + the single-use confirm token.
 * ONLY a 'pending' row with this exact token confirms, and the token is consumed
 * (nulled) in the same update so it can never be replayed. confirming an
 * already-terminal row matches nothing and returns confirmed:false ... the route
 * shows the same page either way, so it leaks no membership state.
 */
export async function confirmSubscriber(
  admin: TypedClient,
  token: string,
): Promise<{ ok: boolean; confirmed: boolean }> {
  if (!isUuid(token)) return { ok: true, confirmed: false };
  const { data, error } = await admin
    .from("np_subscriber")
    .update({
      status: "subscribed",
      confirmed_at: new Date().toISOString(),
      confirm_token: null,
    })
    .eq("confirm_token", token)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, confirmed: false };
  return { ok: true, confirmed: !!data };
}

/**
 * unsubscribe by the STABLE unsubscribe token (the only token that ever rides in
 * a footer). idempotent: a re-click on an already-unsubscribed row is a harmless
 * no-op. the token is not consumed, so the link keeps working forever.
 */
export async function unsubscribeByToken(
  admin: TypedClient,
  token: string,
): Promise<{ ok: boolean; unsubscribed: boolean }> {
  if (!isUuid(token)) return { ok: true, unsubscribed: false };
  const { data, error } = await admin
    .from("np_subscriber")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, unsubscribed: false };
  return { ok: true, unsubscribed: !!data };
}

// a recipient carrying the stable unsubscribe token, so the newsletter footer
// can print each reader's own one-tap unsubscribe link. extends the pure
// Recipient shape, so eligibleRecipients<T> preserves the token.
export interface SubscriberRecipient extends Recipient {
  unsubscribeToken: string;
}

/**
 * the writer's CONFIRMED subscribers, for the newsletter blast. RLS scopes to
 * the caller's own rows (the writer's session client). returns the email
 * Recipient shape plus the unsubscribe token; the pure eligibleRecipients()
 * applies the final confirmed_at + dedupe gate so the send path and the count
 * preview can never disagree.
 */
export async function listConfirmedSubscribers(
  client: ServerClient,
  userId: string,
): Promise<SubscriberRecipient[]> {
  const typed = client as unknown as TypedClient;
  const { data, error } = await typed
    .from("np_subscriber")
    .select("id, email, status, confirmed_at, unsubscribe_token")
    .eq("user_id", userId)
    .eq("status", "subscribed");
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    email: r.email,
    status: r.status,
    confirmedAt: r.confirmed_at,
    unsubscribeToken: r.unsubscribe_token,
  }));
}

export interface EmailLogRow {
  userId: string;
  subscriberId?: string | null;
  pieceId?: string | null;
  dispatchId?: string | null;
  kind: "confirm" | "newsletter";
  toEmail: string;
  subject?: string | null;
  status: "sent" | "stubbed" | "failed";
  providerId?: string | null;
  error?: string | null;
}

/**
 * append one row to nova's OWN send audit log (np_email_log, never the shared
 * email_* tables). non-fatal: a log failure must never break a send. for confirm
 * sends the admin client writes the row (anonymous context, attributed to the
 * writer via user_id); for the newsletter blast the writer's session client
 * writes its own rows.
 */
export async function logEmail(client: TypedClient, row: EmailLogRow): Promise<{ ok: boolean }> {
  try {
    const { error } = await client.from("np_email_log").insert({
      user_id: row.userId,
      subscriber_id: row.subscriberId ?? null,
      piece_id: row.pieceId ?? null,
      dispatch_id: row.dispatchId ?? null,
      kind: row.kind,
      to_email: row.toEmail,
      subject: row.subject ?? null,
      status: row.status,
      provider_id: row.providerId ?? null,
      error: row.error ?? null,
    });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
