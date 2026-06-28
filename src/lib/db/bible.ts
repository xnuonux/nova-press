import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

import type { KnownName } from "@/lib/continuity/types";

import {
  composeBible,
  composeBibleForMentions,
  type BibleEntityView,
  type BibleEntityViewWithId,
} from "./bible-compose";

// the world bible read ... the codex the ai author consults so a drafted beat /
// coined line stays in-world. given a work, it resolves the bible-owning work (a
// book points at its series' bible via np_works.bible_work_id), reads the
// entities + their aliases + facts (RLS owner-scoped), and composes a compact,
// bounded string for the reserved bible slot in the author prompt. it NEVER
// throws ... a bible read must never be the reason a generation fails (the
// getWriterVoice discipline). the model-driven continuity SCAN that writes this
// bible is phase 4.2; this is the read half + the author wiring. the pure
// composition lives in bible-compose.ts (unit-tested headless).

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

// the embedded row shape PostgREST returns for the entities + their aliases/facts.
// it carries the id so retrieval-by-mention can filter on it.
interface EntityRow {
  id: string;
  name: string | null;
  kind: string | null;
  summary: string | null;
  np_bible_aliases?: { alias: string | null }[] | null;
  np_bible_facts?: { fact: string | null }[] | null;
}

function rowToView(row: EntityRow): BibleEntityView {
  return {
    name: row.name ?? "",
    kind: row.kind ?? "",
    summary: row.summary ?? null,
    aliases: (row.np_bible_aliases ?? []).map((a) => a.alias ?? "").filter(Boolean),
    facts: (row.np_bible_facts ?? []).map((f) => f.fact ?? "").filter(Boolean),
  };
}

// resolve the effective bible-owning work ... a series volume shares its series'
// codex via np_works.bible_work_id, defaulting to the work itself.
async function resolveBibleWorkId(typed: TypedClient, workId: string): Promise<string> {
  const { data: work } = await typed
    .from("np_works")
    .select("bible_work_id")
    .eq("id", workId)
    .maybeSingle();
  return (work?.bible_work_id as string | null) ?? workId;
}

// the work's bible rows (entities + embedded aliases/facts), most-recent first,
// scoped to the bible-owning work. the shared read behind both the full compose
// and the retrieval-narrowed one. callers wrap in try/catch ... a bible read must
// never break a generation.
async function readBibleRows(typed: TypedClient, workId: string): Promise<EntityRow[]> {
  const bibleWorkId = await resolveBibleWorkId(typed, workId);
  const { data, error } = await typed
    .from("np_bible_entities")
    .select("id, name, kind, summary, np_bible_aliases(alias), np_bible_facts(fact)")
    // scope to the bible-owning work ... RLS only gates by user, so without this a
    // writer with several works would read EVERY work's codex into the slot.
    .eq("work_id", bibleWorkId)
    // most-recent first ... composeBible head-truncates a large bible, so the
    // newly-introduced nouns (the ones a writer drafting the latest chapter needs
    // grounded) survive, never the oldest.
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as EntityRow[];
}

/**
 * the compact world bible for a work, ready for the author prompt's reserved
 * slot. resolves the effective bible work (bible_work_id ?? the work itself, so
 * a series volume shares its series' codex), reads the entities + embedded
 * aliases + facts (RLS owner-scoped), and composes. returns "" on a missing
 * work, an empty bible, or ANY error ... a degraded bible read can never break a
 * generation.
 */
export async function readBibleForWork(client: ServerClient, workId: string): Promise<string> {
  const typed = client as unknown as TypedClient;
  try {
    return composeBible((await readBibleRows(typed, workId)).map(rowToView));
  } catch {
    return "";
  }
}

/**
 * the world bible NARROWED to what a beat actually names (retrieval-by-mention) ...
 * the author prompt's bible slot for a drafted beat. reads the same rows, but
 * composes only the entities the text mentions (an exact / token / trigram hit on
 * a name or alias), so a beat carries just its relevant cast, not the whole codex.
 * a beat that names nothing established yields "" ... the honest empty slot. like
 * readBibleForWork it returns "" on any error: a degraded read never breaks a
 * generation.
 */
export async function readBibleForWorkMentioned(
  client: ServerClient,
  workId: string,
  text: string,
): Promise<string> {
  const typed = client as unknown as TypedClient;
  try {
    const views: BibleEntityViewWithId[] = (await readBibleRows(typed, workId)).map((r) => ({
      entityId: r.id,
      ...rowToView(r),
    }));
    return composeBibleForMentions(views, text);
  } catch {
    return "";
  }
}

// the embedded row shape for the names read (entity id + name + aliases only).
interface NameRow {
  id: string;
  name: string | null;
  np_bible_aliases?: { alias: string | null }[] | null;
}

/**
 * the work's bible names ... each entity's id + the names it answers to, for the
 * deterministic continuity pass (name-drift). resolves the effective bible work
 * like readBibleForWork, RLS owner-scoped, and NEVER throws (a degraded read just
 * yields no names, so a scan still runs its model layer).
 */
export async function readBibleNames(client: ServerClient, workId: string): Promise<KnownName[]> {
  const typed = client as unknown as TypedClient;
  try {
    const bibleWorkId = await resolveBibleWorkId(typed, workId);

    const { data, error } = await typed
      .from("np_bible_entities")
      .select("id, name, np_bible_aliases(alias)")
      .eq("work_id", bibleWorkId);
    if (error || !data) return [];

    return (data as unknown as NameRow[])
      .map((e) => ({
        entityId: e.id,
        name: e.name ?? "",
        aliases: (e.np_bible_aliases ?? []).map((a) => a.alias ?? "").filter(Boolean),
      }))
      .filter((k) => k.name.trim().length > 0);
  } catch {
    return [];
  }
}
