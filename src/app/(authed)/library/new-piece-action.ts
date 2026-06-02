"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { createDraftPiece } from "@/lib/db/pieces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// server action triggered by the "new piece" button on /library.
// inserts a fresh draft (db defaults handle title, body, status), then
// redirects to /editor/<id>. the (authed) layout already gates this
// route by session, but server actions can be invoked from anywhere a
// form is mounted, so we re-check session defensively here.
export async function newPieceAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await createDraftPiece(supabase, user.id);
  redirect(`/editor/${id}` as Route);
}
