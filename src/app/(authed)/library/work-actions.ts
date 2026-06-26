"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { createWork, promotePieceToWork } from "@/lib/db/works";
import { isFormKey } from "@/lib/forms/registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// "new work" from /library ... create a Work for the chosen form profile (the
// registry seeds its skeleton), then open its binder. an unknown / missing form
// falls back to 'prose' (a single open page) inside createWork.
export async function newWorkAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const raw = String(formData.get("formProfile") ?? "prose");
  const formProfile = isFormKey(raw) ? raw : "prose";
  const { workId } = await createWork(supabase, user.id, formProfile);
  redirect(`/work/${workId}` as Route);
}

// grow a standalone library piece into a Work ... the zero-friction on-ramp. the
// piece becomes the work's single leaf (body + slug + voice carried over), then
// we open the binder so the writer can branch it into a manuscript.
export async function promotePieceToWorkAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const pieceId = String(formData.get("pieceId") ?? "");
  if (!pieceId) {
    redirect("/library" as Route);
  }
  const { workId } = await promotePieceToWork(supabase, user.id, pieceId);
  redirect(`/work/${workId}` as Route);
}
