"use server";

import { publishPiece } from "@/lib/db/pieces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// server action behind the editor's "publish" button. re-checks the session
// defensively; RLS (via the session cookie) gates the write to the caller's own
// row inside publishPiece. returns the public path so the editor can show and
// link it.
export async function publishPieceAction(pieceId: string): Promise<{ slug: string; url: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("not authenticated");
  }
  const { slug } = await publishPiece(supabase, pieceId);
  return { slug, url: `/p/${slug}` };
}
