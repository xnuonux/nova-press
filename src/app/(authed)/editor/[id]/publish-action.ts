"use server";

import { publishPiece } from "@/lib/db/pieces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PublishResult =
  | { ok: true; slug: string; url: string }
  | { ok: false; error: string };

// server action behind the editor's "publish" button. re-checks the session
// defensively; RLS (via the session cookie) gates the write to the caller's own
// row inside publishPiece. it RETURNS the outcome (never throws on a publish
// failure) so the real reason ... e.g. "can't publish an empty piece" ...
// survives next's prod error redaction and the editor can show it.
export async function publishPieceAction(pieceId: string): Promise<PublishResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "you're not signed in" };
  }
  try {
    const { slug } = await publishPiece(supabase, pieceId);
    return { ok: true, slug, url: `/p/${slug}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "couldn't publish this one" };
  }
}
