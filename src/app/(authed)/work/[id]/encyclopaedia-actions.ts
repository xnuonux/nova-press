"use server";

import {
  addArticle,
  deleteArticle,
  listArticles,
  updateArticleInfobox,
  type ArticleEntry,
} from "@/lib/db/articles";
import { getWorkById } from "@/lib/db/works";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// the encyclopaedia article writes ... the infobox half of a record_prose article
// (the prose half is edited in the normal editor). each re-checks the session AND
// that the caller owns the work (getWorkById is RLS-gated, so a stranger's work
// reads null), validates inside the db / pure layer, and hands back the work's
// fresh article list so the panel re-renders without a reload. mirrors the conlang
// + codex actions.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownWorkOrNull(workId: string) {
  if (!UUID_RE.test(workId)) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const work = await getWorkById(supabase, workId);
  if (!work) return null;
  return { supabase, userId: user.id };
}

export interface InfoboxFormInput {
  title: string;
  aka: string[];
  classification: string;
  summary: string;
  attributes: string[];
}

export interface ArticleActionResult {
  ok: boolean;
  error?: string;
  articles: ArticleEntry[];
  // the new article's prose piece, so the UI can offer to open the editor.
  pieceId?: string | null;
}

export async function addArticleAction(
  workId: string,
  input: InfoboxFormInput,
): Promise<ArticleActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false, error: "couldn't save that ... try again.", articles: [] };

  const res = await addArticle(ctx.supabase, ctx.userId, workId, input);
  const articles = await listArticles(ctx.supabase, workId);
  return res.ok
    ? { ok: true, articles, pieceId: res.pieceId }
    : { ok: false, error: res.error, articles };
}

export async function updateArticleInfoboxAction(
  workId: string,
  nodeId: string,
  input: InfoboxFormInput,
): Promise<ArticleActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false, error: "couldn't save that ... try again.", articles: [] };

  const res = await updateArticleInfobox(ctx.supabase, workId, nodeId, input);
  const articles = await listArticles(ctx.supabase, workId);
  return res.ok ? { ok: true, articles } : { ok: false, error: res.error, articles };
}

export async function deleteArticleAction(
  workId: string,
  nodeId: string,
): Promise<ArticleActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false, error: "couldn't remove that ... try again.", articles: [] };

  const res = await deleteArticle(ctx.supabase, workId, nodeId);
  const articles = await listArticles(ctx.supabase, workId);
  return res.ok ? { ok: true, articles } : { ok: false, error: res.error, articles };
}
