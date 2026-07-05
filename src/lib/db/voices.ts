import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";
import {
  deltaToOverrides,
  normalizeVoiceDelta,
  rowToDelta,
  type VoiceDelta,
  type VoiceDeltaDraft,
} from "@/lib/voices/delta";

import { getWorkById, updateWork } from "./works";

// the multi-voice db layer ... a work's CAST of delta voices on np_voices (one
// named overlay per row: name/register/summary are columns, the rest of the
// sparse overlay rides the `overrides` jsonb). RLS owner-scopes every read +
// write; reads NEVER throw (a degraded read yields [] / null); writes return a
// discriminated result + the refreshed cast. the work's ACTIVE voice rides
// work.settings.activeVoiceId (read-modify-write, never clobbering a sibling
// key like settings.phonology). mirrors db/lexicon.ts + db/articles.ts.

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;
type VoiceRow = Database["public"]["Tables"]["np_voices"]["Row"];

export interface VoiceEntry extends VoiceDelta {
  id: string;
}

export type VoiceResult =
  | { ok: true; id: string; voices: VoiceEntry[] }
  | { ok: false; error: string };

function rowToEntry(row: VoiceRow): VoiceEntry {
  return {
    id: row.id,
    ...rowToDelta({
      name: row.name,
      register: row.register,
      summary: row.summary,
      overrides: row.overrides,
    }),
  };
}

/** the work's cast of voices, position-ordered. RLS owner-scoped. never throws
 *  (a degraded read yields []). */
export async function listVoices(client: ServerClient, workId: string): Promise<VoiceEntry[]> {
  try {
    const typed = client as unknown as TypedClient;
    const { data, error } = await typed
      .from("np_voices")
      .select("*")
      .eq("work_id", workId)
      // position is the primary order; created_at + id break any tie so the cast
      // never reorders across reads (a delete-then-add can share a position).
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) return [];
    return (data ?? []).map((r) => rowToEntry(r as VoiceRow));
  } catch {
    return [];
  }
}

/** one voice by id, scoped to the work. never throws (null on miss / error). */
export async function getVoiceById(
  client: ServerClient,
  workId: string,
  voiceId: string,
): Promise<VoiceEntry | null> {
  try {
    const typed = client as unknown as TypedClient;
    const { data, error } = await typed
      .from("np_voices")
      .select("*")
      .eq("id", voiceId)
      .eq("work_id", workId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToEntry(data as VoiceRow);
  } catch {
    return null;
  }
}

/** add a voice to the work's cast (one atomic insert ... name + register +
 *  summary columns, the rest in `overrides`). returns the new id + refreshed cast. */
export async function addVoice(
  client: ServerClient,
  userId: string,
  workId: string,
  draft: VoiceDeltaDraft,
): Promise<VoiceResult> {
  const norm = normalizeVoiceDelta(draft);
  if (!norm.ok || !norm.delta) {
    return { ok: false, error: norm.error ?? "couldn't read that voice." };
  }
  try {
    const typed = client as unknown as TypedClient;
    // append at the end of the cast: max(position)+1, NOT a count, so a mid-cast
    // delete (which frees a slot) never makes a later add collide on position.
    // owner-scoped read; a hiccup degrades to 0 (the tiebreak sort still orders).
    let position = 0;
    const { data: top } = await typed
      .from("np_voices")
      .select("position")
      .eq("work_id", workId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (top && typeof top.position === "number") position = top.position + 1;
    const { data, error } = await typed
      .from("np_voices")
      .insert({
        user_id: userId,
        work_id: workId,
        name: norm.delta.name,
        register: norm.delta.register,
        summary: norm.delta.summary,
        overrides: deltaToOverrides(norm.delta) as unknown as Json,
        position,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "couldn't save that voice ... try again." };
    const voices = await listVoices(client, workId);
    return { ok: true, id: data.id, voices };
  } catch {
    return { ok: false, error: "couldn't save that voice ... try again." };
  }
}

/** edit a voice's overlay, scoped to this work. */
export async function updateVoice(
  client: ServerClient,
  workId: string,
  voiceId: string,
  draft: VoiceDeltaDraft,
): Promise<VoiceResult> {
  const norm = normalizeVoiceDelta(draft);
  if (!norm.ok || !norm.delta) {
    return { ok: false, error: norm.error ?? "couldn't read that voice." };
  }
  try {
    const typed = client as unknown as TypedClient;
    const { data, error } = await typed
      .from("np_voices")
      .update({
        name: norm.delta.name,
        register: norm.delta.register,
        summary: norm.delta.summary,
        overrides: deltaToOverrides(norm.delta) as unknown as Json,
      })
      .eq("id", voiceId)
      .eq("work_id", workId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: "couldn't save that voice ... try again." };
    if (!data) return { ok: false, error: "couldn't find that voice." };
    const voices = await listVoices(client, workId);
    return { ok: true, id: voiceId, voices };
  } catch {
    return { ok: false, error: "couldn't save that voice ... try again." };
  }
}

/** remove a voice from the cast, scoped to this work. if it was the work's active
 *  voice, the active selection is cleared so generation falls back to the narrator. */
export async function deleteVoice(
  client: ServerClient,
  workId: string,
  voiceId: string,
): Promise<VoiceResult> {
  try {
    const typed = client as unknown as TypedClient;
    const { data, error } = await typed
      .from("np_voices")
      .delete()
      .eq("id", voiceId)
      .eq("work_id", workId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: "couldn't remove that voice ... try again." };
    if (!data) return { ok: false, error: "couldn't find that voice." };
    // a deleted active voice must not keep governing generation.
    await clearActiveVoiceIfMatch(client, workId, voiceId);
    const voices = await listVoices(client, workId);
    return { ok: true, id: voiceId, voices };
  } catch {
    return { ok: false, error: "couldn't remove that voice ... try again." };
  }
}

// the work's active voice id, off settings.activeVoiceId, or null. never throws.
function readActiveVoiceId(settings: Record<string, unknown> | null | undefined): string | null {
  const v = settings?.activeVoiceId;
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** the work's active voice id (the raw settings.activeVoiceId), or null. the panel
 *  highlights it; a stale id pointing at a deleted voice resolves to null in
 *  generation anyway. never throws. */
export async function getActiveVoiceId(
  client: ServerClient,
  workId: string,
): Promise<string | null> {
  try {
    const work = await getWorkById(client, workId);
    return readActiveVoiceId(work?.settings);
  } catch {
    return null;
  }
}

/** the active delta voice governing this work's generation (settings.activeVoiceId
 *  -> the np_voices row), or null when the narrator is active / nothing is set.
 *  never throws. */
export async function readActiveVoice(
  client: ServerClient,
  workId: string,
): Promise<VoiceEntry | null> {
  try {
    const work = await getWorkById(client, workId);
    const activeId = readActiveVoiceId(work?.settings);
    if (!activeId) return null;
    return await getVoiceById(client, workId, activeId);
  } catch {
    return null;
  }
}

/** set (or clear, with null) the work's active voice via a settings merge that
 *  never clobbers a sibling key (settings.phonology et al). returns the cast so
 *  the caller can re-render. owner-scoped through getWorkById + updateWork. */
export async function setActiveVoice(
  client: ServerClient,
  workId: string,
  voiceId: string | null,
): Promise<VoiceResult> {
  try {
    const work = await getWorkById(client, workId);
    if (!work) return { ok: false, error: "couldn't find that work." };
    // a non-null target must be a real voice in this work (no dangling pointer).
    if (voiceId) {
      const exists = await getVoiceById(client, workId, voiceId);
      if (!exists) return { ok: false, error: "couldn't find that voice." };
    }
    const settings: Record<string, unknown> = { ...(work.settings ?? {}) };
    if (voiceId) settings.activeVoiceId = voiceId;
    else delete settings.activeVoiceId;
    await updateWork(client, workId, { settings });
    const voices = await listVoices(client, workId);
    return { ok: true, id: voiceId ?? "", voices };
  } catch {
    return { ok: false, error: "couldn't switch the voice ... try again." };
  }
}

// drop the work's active voice if it points at the given (just-deleted) id.
async function clearActiveVoiceIfMatch(
  client: ServerClient,
  workId: string,
  voiceId: string,
): Promise<void> {
  try {
    const work = await getWorkById(client, workId);
    if (readActiveVoiceId(work?.settings) !== voiceId) return;
    const settings: Record<string, unknown> = { ...(work?.settings ?? {}) };
    delete settings.activeVoiceId;
    await updateWork(client, workId, { settings });
  } catch {
    // a cleanup hiccup must never fail the delete; a dangling active id resolves
    // to null at read time anyway (getVoiceById returns null for a gone voice).
  }
}
