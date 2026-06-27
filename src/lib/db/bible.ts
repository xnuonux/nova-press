import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

import { composeBible, type BibleEntityView } from "./bible-compose";

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
interface EntityRow {
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
    const { data: work } = await typed
      .from("np_works")
      .select("bible_work_id")
      .eq("id", workId)
      .maybeSingle();
    const bibleWorkId = (work?.bible_work_id as string | null) ?? workId;

    const { data, error } = await typed
      .from("np_bible_entities")
      .select("name, kind, summary, np_bible_aliases(alias), np_bible_facts(fact)")
      // most-recent first ... composeBible head-truncates a large bible, so the
      // newly-introduced nouns (the ones a writer drafting the latest chapter
      // needs grounded) are the ones that survive, never the oldest.
      .order("created_at", { ascending: false });
    if (error || !data) return "";

    return composeBible((data as unknown as EntityRow[]).map(rowToView));
  } catch {
    return "";
  }
}
