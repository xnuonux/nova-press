import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { composeVoiceCompactView, type VoiceProfileFields } from "@/lib/ai/voice-compact";
import type { ExtractedVoice } from "@/lib/ai/voice-extract";
import { insertVoiceSnapshot } from "@/lib/db/voice-snapshots";
import { reportError } from "@/lib/observability/report-error";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";

// same ssr-vs-supabase-js generic mismatch as lib/db/pieces ... cast once for
// Database-typed inference without changing the factory signatures.
type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

// only the columns CLAUDE.md lets nova READ off the shared voice_profiles
// table. never the outreach_* columns (gen connect's). writing_overrides is
// nova's, and carries the summary + the exemplars the extraction wrote.
const VOICE_COLUMNS =
  "register, vocabulary_signature, sentence_length_avg, avoided_phrases, idiosyncratic_phrases, opening_patterns, closing_patterns, writing_overrides, active_for_writing";

export interface WriterVoice {
  // the distilled compact line for the prompt's voice slot.
  voiceCompactView?: string;
  // a few in-voice exemplar lines for the prompt's exemplars slot.
  exemplars?: string[];
}

function roundOrNull(n: number | null): number | null {
  return n === null ? null : Math.round(n);
}

// pull exemplars out of writing_overrides (nova's jsonb column), defensively.
function readExemplars(overrides: unknown): string[] {
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    const ex = (overrides as Record<string, unknown>).exemplars;
    if (Array.isArray(ex)) {
      return ex
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 3);
    }
  }
  return [];
}

/**
 * the signed-in writer's voice for the prompt: the compact line + a few in-voice
 * exemplars. rls scopes voice_profiles to the caller's own row, so a missing /
 * empty / mirroring-off profile just returns {} and the prompt keeps its honest
 * "not yet trained" fallback. it NEVER throws ... a voice read must never be the
 * reason a generation fails.
 */
export async function getWriterVoice(client: ServerClient, userId: string): Promise<WriterVoice> {
  const typed = client as unknown as TypedClient;
  try {
    const { data, error } = await typed
      .from("voice_profiles")
      .select(VOICE_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return {};
    const fields = data as unknown as VoiceProfileFields;
    // a mirroring-off profile contributes nothing, same as composeVoiceCompactView.
    if (fields.active_for_writing === false) return {};
    const voiceCompactView = composeVoiceCompactView(fields);
    const exemplars = readExemplars(fields.writing_overrides);
    return { voiceCompactView, exemplars: exemplars.length ? exemplars : undefined };
  } catch {
    return {};
  }
}

/**
 * write the extracted voice back to the shared voice_profiles row. upsert on
 * user_id with ONLY nova's columns in the payload, so a conflict update never
 * touches gen connect's outreach_* columns (they keep their values / defaults).
 * last-writer-wins on the base voice columns per CLAUDE.md; writing_overrides
 * (summary + exemplars), writing_samples_count, active_for_writing, and the
 * extraction metadata are nova's to own.
 */
export async function saveWriterVoice(
  client: ServerClient,
  userId: string,
  v: ExtractedVoice,
): Promise<void> {
  const typed = client as unknown as TypedClient;
  const nowIso = new Date().toISOString();

  // append to the shared extraction_history audit trail, trimmed to the last 5
  // (CLAUDE.md: append-only by both products). read-then-write carries a minor
  // clobber race, acceptable for a per-user, user-triggered extraction.
  const { data: existing } = await typed
    .from("voice_profiles")
    .select("extraction_history")
    .eq("user_id", userId)
    .maybeSingle();
  const rawHistory = existing?.extraction_history;
  const priorHistory: Json[] = Array.isArray(rawHistory) ? (rawHistory as Json[]) : [];
  const extraction_history: Json[] = [
    ...priorHistory,
    {
      at: nowIso,
      by: "nova_press",
      model: v.model,
      confidence: v.confidence,
      samples: v.samples_count,
    },
  ].slice(-5);

  const { error } = await typed.from("voice_profiles").upsert(
    {
      user_id: userId,
      register: v.register,
      vocabulary_signature: v.vocabulary_signature,
      // sentence/paragraph _avg are integer columns in the shared schema (the
      // _variance columns are numeric) ... round the averages, keep variance.
      sentence_length_avg: roundOrNull(v.stats.sentence_length_avg),
      sentence_length_variance: v.stats.sentence_length_variance,
      paragraph_length_avg: roundOrNull(v.stats.paragraph_length_avg),
      paragraph_length_variance: v.stats.paragraph_length_variance,
      formality_score: v.formality_score,
      opening_patterns: v.opening_patterns,
      closing_patterns: v.closing_patterns,
      avoided_phrases: v.avoided_phrases,
      idiosyncratic_phrases: v.idiosyncratic_phrases,
      punctuation_style: v.stats.punctuation_style,
      emoji_signature: v.stats.emoji_signature,
      writing_overrides: { summary: v.summary, exemplars: v.exemplars },
      writing_samples_count: v.samples_count,
      active_for_writing: true,
      last_extracted_at: nowIso,
      last_extracted_by: "nova_press",
      extraction_model: v.model,
      extraction_confidence: v.confidence,
      extraction_history,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`failed to save voice profile: ${error.message}`);

  // the longitudinal self: photograph this freshly-distilled fingerprint into an
  // immutable, denormalized snapshot, keyed to the SAME nowIso so the dot and the
  // live row agree. captured here off nova's OWN ExtractedVoice (never a trigger
  // on the shared voice_profiles row, which gen connect also writes). NON-FATAL:
  // insertVoiceSnapshot swallows internally, and this catch is belt-and-suspenders
  // so a history hiccup can NEVER turn the train-my-voice click into a 502 ... the
  // upsert above is the source of truth, the snapshot is bonus history.
  try {
    await insertVoiceSnapshot(client, userId, v, nowIso);
  } catch (snapErr) {
    reportError(snapErr, { tag: "voice-snapshot-capture-failed", userId });
  }
}
