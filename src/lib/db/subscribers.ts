import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

type TypedClient = SupabaseClient<Database>;

// a forgiving but real email check ... we're capturing a reader's address for a
// writer's list, not validating an rfc: one @, something either side, a dot in
// the domain, bounded length (matches the db CHECK).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 320 && EMAIL_RE.test(trimmed);
}

export type SubscribeResult = { ok: true; already: boolean } | { ok: false; error: string };

// capture an anonymous reader's email for a writer's list. service-role insert
// (the reader isn't signed in and np_subscriber is RLS owner-only), idempotent
// on the (user_id, lower(email)) unique index ... a re-subscribe is a no-op
// success, never a leak of "you're already on this list".
export async function addSubscriber(
  admin: TypedClient,
  input: { userId: string; email: string; pieceId?: string | null; slug?: string | null },
): Promise<SubscribeResult> {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "that email doesn't look right" };

  const { error } = await admin.from("np_subscriber").insert({
    user_id: input.userId,
    email,
    piece_id: input.pieceId ?? null,
    source_slug: input.slug ?? null,
  });

  if (error) {
    // 23505 = unique violation = already on this list. that's a success, and we
    // don't tell the reader they were already subscribed (avoids an enumeration
    // signal on someone else's list).
    if (error.code === "23505") return { ok: true, already: true };
    return { ok: false, error: "couldn't save that ... try again in a sec" };
  }
  return { ok: true, already: false };
}
