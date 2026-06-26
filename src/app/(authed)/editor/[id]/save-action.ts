"use server";

import { revalidatePath } from "next/cache";
import type { Value } from "platejs";

import { countWords } from "@/lib/utils";
import { deriveExcerpt, plateText } from "@/components/editor/plate-text";
import { savePieceContent } from "@/lib/db/pieces";
import { recomputeWorkWordCounts } from "@/lib/db/works";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";

// server action behind the editor's autosave. the trust boundary: word_count
// and excerpt are derived here from the body the client sends, never taken
// from the client. RLS (via the session cookie) gates the write to the
// caller's own row, and we re-check the session defensively.
export async function savePieceContentAction(
  pieceId: string,
  input: { title: string; body: Value },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("not authenticated");
  }

  const wordCount = countWords(plateText(input.body));
  const excerpt = deriveExcerpt(input.body);

  // the save returns the piece's work_id from the same write (no extra query).
  const { workId } = await savePieceContent(supabase, pieceId, {
    // plate's Value is json-serializable at runtime but not structurally
    // assignable to supabase's Json type ... cast at this boundary.
    body: input.body as unknown as Json,
    title: input.title,
    word_count: wordCount,
    excerpt,
  });

  // if this piece is a leaf of a Work, roll its fresh word count up the tree so
  // the binder's chapter + work totals stay live. a standalone library piece has
  // no workId, so this is a strict no-op and the plain editor flow is untouched.
  if (workId) {
    await recomputeWorkWordCounts(supabase, workId);
    revalidatePath(`/work/${workId}`);
  }
}
