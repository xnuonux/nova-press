import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isEntityKind,
  normalizeEntity,
  type EntityDraft,
  type EntityKind,
} from "@/lib/codex/validate";
import { reportError } from "@/lib/observability/report-error";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

// the codex db layer ... the bible as an editable surface. it reads, creates,
// edits, and removes np_bible_entities (+ their np_bible_aliases / np_bible_facts
// children), scoped to the work's EFFECTIVE bible (a series volume shares its
// series' codex via np_works.bible_work_id). RLS gates every write to the owner;
// the work_id scope ties an edit to THIS bible. reads NEVER throw (the
// readBibleForWork discipline ... a degraded codex read can't break the page);
// writes return a discriminated result with a calm reason. the alias/fact set is
// the entity's to own ... an edit replaces it wholesale (delete by entity_id then
// re-insert), and a delete leans on the FK ON DELETE CASCADE.

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

/** a codex entity as the editor sees it ... the row plus its alias / fact sets. */
export interface CodexEntity {
  id: string;
  name: string;
  kind: EntityKind;
  summary: string | null;
  aliases: string[];
  facts: string[];
}

export type CodexResult = { ok: true; entityId: string } | { ok: false; error: string };

interface EntityRow {
  id: string;
  name: string | null;
  kind: string | null;
  summary: string | null;
  np_bible_aliases?: { alias: string | null }[] | null;
  np_bible_facts?: { fact: string | null }[] | null;
}

function rowToEntity(row: EntityRow): CodexEntity {
  return {
    id: row.id,
    name: row.name ?? "",
    // the db CHECK guarantees a real kind; the guard is belt-and-braces so a
    // surprise value falls back rather than widening CodexEntity.kind to string.
    kind: isEntityKind(row.kind) ? row.kind : "lore",
    summary: row.summary,
    aliases: (row.np_bible_aliases ?? []).map((a) => a.alias ?? "").filter(Boolean),
    facts: (row.np_bible_facts ?? []).map((f) => f.fact ?? "").filter(Boolean),
  };
}

/** resolve the effective bible-owning work (bible_work_id ?? the work itself), so
 *  every codex op lands in the one shared codex of a series. never throws. */
export async function resolveBibleWorkId(client: ServerClient, workId: string): Promise<string> {
  const typed = client as unknown as TypedClient;
  try {
    const { data } = await typed
      .from("np_works")
      .select("bible_work_id")
      .eq("id", workId)
      .maybeSingle();
    return (data?.bible_work_id as string | null) ?? workId;
  } catch {
    return workId;
  }
}

/** the work's whole codex, oldest first (a stable reading order for the editor).
 *  RLS owner-scoped + work-scoped. never throws ... a degraded read yields []. */
export async function listCodexEntities(
  client: ServerClient,
  workId: string,
): Promise<CodexEntity[]> {
  const typed = client as unknown as TypedClient;
  try {
    const bibleWorkId = await resolveBibleWorkId(client, workId);
    const { data, error } = await typed
      .from("np_bible_entities")
      .select("id, name, kind, summary, np_bible_aliases(alias), np_bible_facts(fact)")
      .eq("work_id", bibleWorkId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return (data as unknown as EntityRow[]).map(rowToEntity);
  } catch {
    return [];
  }
}

// write an entity's alias + fact children, returning a result so the caller can
// surface a failure rather than report a false success (a swallowed child-write
// would silently drop the names / facts the writer typed). every child carries
// user_id for its own RLS.
async function writeChildren(
  typed: TypedClient,
  userId: string,
  entityId: string,
  aliases: readonly string[],
  facts: readonly string[],
): Promise<CodexResult> {
  if (aliases.length > 0) {
    const { error } = await typed
      .from("np_bible_aliases")
      .insert(aliases.map((alias) => ({ user_id: userId, entity_id: entityId, alias })));
    if (error) {
      reportError(new Error(error.message), { tag: "codex-alias-write", entityId });
      return { ok: false, error: "couldn't save the names ... try again." };
    }
  }
  if (facts.length > 0) {
    const { error } = await typed
      .from("np_bible_facts")
      .insert(facts.map((fact) => ({ user_id: userId, entity_id: entityId, fact })));
    if (error) {
      reportError(new Error(error.message), { tag: "codex-fact-write", entityId });
      return { ok: false, error: "couldn't save the details ... try again." };
    }
  }
  return { ok: true, entityId };
}

/** create a codex entity (+ its aliases / facts) in the work's effective bible. */
export async function createCodexEntity(
  client: ServerClient,
  userId: string,
  workId: string,
  draft: EntityDraft,
): Promise<CodexResult> {
  const norm = normalizeEntity(draft);
  if (!norm.ok || !norm.entity) {
    return { ok: false, error: norm.error ?? "couldn't read that entry." };
  }
  const e = norm.entity;
  const typed = client as unknown as TypedClient;
  const bibleWorkId = await resolveBibleWorkId(client, workId);

  const { data, error } = await typed
    .from("np_bible_entities")
    .insert({
      user_id: userId,
      work_id: bibleWorkId,
      name: e.name,
      kind: e.kind,
      summary: e.summary,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: "couldn't save that entry ... try again." };
  }

  const childRes = await writeChildren(typed, userId, data.id, e.aliases, e.facts);
  if (!childRes.ok) {
    // roll the orphan entity back so a create is all-or-nothing ... the FK cascade
    // sweeps any children that did land. otherwise a half-written entry would
    // linger with none of the names / facts the writer typed.
    await typed.from("np_bible_entities").delete().eq("id", data.id);
    return childRes;
  }
  return { ok: true, entityId: data.id };
}

/** edit a codex entity in place, replacing its alias / fact set wholesale. scoped
 *  to the effective bible's work so an edit can only touch THIS codex. */
export async function updateCodexEntity(
  client: ServerClient,
  userId: string,
  workId: string,
  entityId: string,
  draft: EntityDraft,
): Promise<CodexResult> {
  const norm = normalizeEntity(draft);
  if (!norm.ok || !norm.entity) {
    return { ok: false, error: norm.error ?? "couldn't read that entry." };
  }
  const e = norm.entity;
  const typed = client as unknown as TypedClient;
  const bibleWorkId = await resolveBibleWorkId(client, workId);

  const { data, error } = await typed
    .from("np_bible_entities")
    .update({ name: e.name, kind: e.kind, summary: e.summary })
    .eq("id", entityId)
    .eq("work_id", bibleWorkId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "couldn't find that entry." };
  }

  // replace the children wholesale: the alias / fact set belongs to the entity.
  // CHECK each delete ... a swallowed delete would leave a stale alias that then
  // collides with the re-insert on the (entity_id, lower(alias)) unique index,
  // failing the whole batch and silently losing the edit. RLS scopes the delete to
  // the owner's own rows for this entity.
  const { error: delAliasErr } = await typed
    .from("np_bible_aliases")
    .delete()
    .eq("entity_id", entityId);
  if (delAliasErr) return { ok: false, error: "couldn't update that entry ... try again." };
  const { error: delFactErr } = await typed
    .from("np_bible_facts")
    .delete()
    .eq("entity_id", entityId);
  if (delFactErr) return { ok: false, error: "couldn't update that entry ... try again." };

  // surface a child-write failure honestly ... the entity name / summary landed,
  // but the writer should know the names / facts didn't (a re-save retries cleanly,
  // since the deletes above are idempotent).
  const childRes = await writeChildren(typed, userId, entityId, e.aliases, e.facts);
  if (!childRes.ok) return childRes;
  return { ok: true, entityId };
}

/** remove a codex entity; its aliases + facts cascade via the FK. scoped to the
 *  effective bible's work + the owner (RLS). */
export async function deleteCodexEntity(
  client: ServerClient,
  workId: string,
  entityId: string,
): Promise<CodexResult> {
  const typed = client as unknown as TypedClient;
  const bibleWorkId = await resolveBibleWorkId(client, workId);
  const { data, error } = await typed
    .from("np_bible_entities")
    .delete()
    .eq("id", entityId)
    .eq("work_id", bibleWorkId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "couldn't remove that entry." };
  if (!data) return { ok: false, error: "couldn't find that entry." };
  return { ok: true, entityId };
}
