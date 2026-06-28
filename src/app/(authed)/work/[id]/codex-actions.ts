"use server";

import {
  createCodexEntity,
  deleteCodexEntity,
  listCodexEntities,
  updateCodexEntity,
  type CodexEntity,
} from "@/lib/db/codex";
import { getWorkById } from "@/lib/db/works";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// the codex's server-authoritative writes. each re-checks the session AND that the
// caller owns the work (getWorkById is RLS-gated, so a stranger's work reads null
// ... the owner gate before any bible write), validates + normalizes inside the db
// layer, then hands back the work's fresh codex so the editor island re-renders
// without a reload. the bible-write scoping (effective bible work, RLS) lives in
// codex.ts.

// np_works.id is a uuid ... a non-uuid would make getWorkById throw a postgres
// 22P02 instead of returning null, surfacing as a raw 500 out of the public
// server-action boundary. a cheap shape guard keeps a malformed id a clean denial,
// matching the scan + author routes.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// the loose shape the codex editor sends ... normalizeEntity hardens it.
export interface EntityFormInput {
  name: string;
  kind: string;
  summary: string;
  aliases: string[];
  facts: string[];
}

export interface CodexActionResult {
  ok: boolean;
  error?: string;
  entities: CodexEntity[];
}

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

export async function createEntityAction(
  workId: string,
  input: EntityFormInput,
): Promise<CodexActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false, error: "couldn't save that ... try again.", entities: [] };

  const res = await createCodexEntity(ctx.supabase, ctx.userId, workId, input);
  const entities = await listCodexEntities(ctx.supabase, workId);
  return res.ok ? { ok: true, entities } : { ok: false, error: res.error, entities };
}

export async function updateEntityAction(
  workId: string,
  entityId: string,
  input: EntityFormInput,
): Promise<CodexActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false, error: "couldn't save that ... try again.", entities: [] };

  const res = await updateCodexEntity(ctx.supabase, ctx.userId, workId, entityId, input);
  const entities = await listCodexEntities(ctx.supabase, workId);
  return res.ok ? { ok: true, entities } : { ok: false, error: res.error, entities };
}

export async function deleteEntityAction(
  workId: string,
  entityId: string,
): Promise<CodexActionResult> {
  const ctx = await ownWorkOrNull(workId);
  if (!ctx) return { ok: false, error: "couldn't remove that ... try again.", entities: [] };

  const res = await deleteCodexEntity(ctx.supabase, workId, entityId);
  const entities = await listCodexEntities(ctx.supabase, workId);
  return res.ok ? { ok: true, entities } : { ok: false, error: res.error, entities };
}
