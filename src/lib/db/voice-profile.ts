import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { snapshotToProfileFields } from "@/lib/ai/voice-ask";
import { composeVoiceCompactView, type VoiceProfileFields } from "@/lib/ai/voice-compact";
import type { ExtractedVoice } from "@/lib/ai/voice-extract";
import { insertVoiceSnapshot, listVoiceSnapshots } from "@/lib/db/voice-snapshots";
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
 *
 * the OPTIONAL activeFork (the voice-switch) re-aims the SOURCE only: when a
 * named strand is active for writing, the voice is composed from that strand's
 * LATEST immutable snapshot instead of the live voice_profiles row. this NEVER
 * writes voice_profiles. when activeFork is undefined/null/'' the function is the
 * pre-change live read, byte-for-byte, so every existing 2-arg caller + test is
 * unchanged. a deleted / un-named / sparse fork falls THROUGH to the live read,
 * so writing silently degrades to your live voice rather than an empty slot.
 */
export async function getWriterVoice(
  client: ServerClient,
  userId: string,
  activeFork?: string | null,
): Promise<WriterVoice> {
  // 1. the active writing fork: source from the strand's latest snapshot.
  if (activeFork) {
    try {
      const snaps = await listVoiceSnapshots(client, userId, 1, activeFork);
      const latest = snaps[0];
      if (latest) {
        const forkVoice = composeVoiceCompactView(snapshotToProfileFields(latest));
        // a thin snapshot composes to undefined ... treat that as "no real texture
        // yet" and fall through to the live voice, not an empty prompt slot.
        // snapshots carry no exemplars, so exemplars stays an honest undefined.
        if (forkVoice) return { voiceCompactView: forkVoice };
      }
    } catch {
      // a fork-source hiccup must never beat the live fallback or fail a generation.
    }
  }

  // 2. the live path ... byte-for-byte the pre-change body.
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

// a read-only, display-ready view of the writer's distilled voice ... the
// columns CLAUDE.md lets nova read, camelCased, for the studio's "your voice at
// a glance" card. never the outreach_* columns.
export interface VoiceCard {
  register: string | null;
  vocabularySignature: string | null;
  sentenceLengthAvg: number | null;
  sentenceLengthVariance: number | null;
  paragraphLengthAvg: number | null;
  formalityScore: number | null;
  openingPatterns: string[];
  closingPatterns: string[];
  idiosyncraticPhrases: string[];
  avoidedPhrases: string[];
  writingSamplesCount: number;
  lastExtractedAt: string | null;
  extractionConfidence: number | null;
  activeForWriting: boolean;
}

const VOICE_CARD_COLUMNS =
  "register, vocabulary_signature, sentence_length_avg, sentence_length_variance, paragraph_length_avg, formality_score, opening_patterns, closing_patterns, idiosyncratic_phrases, avoided_phrases, writing_samples_count, last_extracted_at, extraction_confidence, active_for_writing";

function strArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
    : [];
}

/**
 * the signed-in writer's distilled voice for the studio's at-a-glance card.
 * READ-ONLY, RLS owner-scoped, never throws. returns null when the voice is
 * untrained ... a row with no register AND no samples (e.g. one another surface
 * created) reads as untrained, so the studio shows its honest empty state rather
 * than a blank card. this NEVER writes voice_profiles.
 */
export async function readVoiceCard(
  client: ServerClient,
  userId: string,
): Promise<VoiceCard | null> {
  const typed = client as unknown as TypedClient;
  try {
    const { data, error } = await typed
      .from("voice_profiles")
      .select(VOICE_CARD_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const r = data as Record<string, unknown>;
    const register = typeof r.register === "string" && r.register.trim() ? r.register.trim() : null;
    const samples = typeof r.writing_samples_count === "number" ? r.writing_samples_count : 0;
    if (!register && samples === 0) return null;
    return {
      register,
      vocabularySignature:
        typeof r.vocabulary_signature === "string" ? r.vocabulary_signature : null,
      sentenceLengthAvg: typeof r.sentence_length_avg === "number" ? r.sentence_length_avg : null,
      sentenceLengthVariance:
        typeof r.sentence_length_variance === "number" ? r.sentence_length_variance : null,
      paragraphLengthAvg:
        typeof r.paragraph_length_avg === "number" ? r.paragraph_length_avg : null,
      formalityScore: typeof r.formality_score === "number" ? r.formality_score : null,
      openingPatterns: strArray(r.opening_patterns),
      closingPatterns: strArray(r.closing_patterns),
      idiosyncraticPhrases: strArray(r.idiosyncratic_phrases),
      avoidedPhrases: strArray(r.avoided_phrases),
      writingSamplesCount: samples,
      lastExtractedAt: typeof r.last_extracted_at === "string" ? r.last_extracted_at : null,
      extractionConfidence:
        typeof r.extraction_confidence === "number" ? r.extraction_confidence : null,
      activeForWriting: r.active_for_writing !== false,
    };
  } catch {
    return null;
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
