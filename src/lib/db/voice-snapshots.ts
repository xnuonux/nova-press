import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExtractedVoice } from "@/lib/ai/voice-extract";
import { reportError } from "@/lib/observability/report-error";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

// same ssr-vs-supabase-js generic mismatch as the rest of lib/db ... cast once
// per function for Database-typed inference without changing the factory.
type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type TypedClient = SupabaseClient<Database>;

// the denormalized insert payload ... a frozen point-in-time COPY of the
// distilled voice. an EXPLICIT shape (not the generated Insert) so the pure
// mapper is testable with no db types, and so it can NEVER carry an outreach_*
// key: gen connect's columns are physically absent from this type.
export interface SnapshotInsert {
  user_id: string;
  captured_at: string;
  source: "extraction";
  // widened to string|null so the type admits a (future) born-labeled snapshot;
  // extractedVoiceToSnapshot still emits null, so new snapshots are born into
  // "your voice" (the null strand). naming happens later via setSnapshotForkLabel.
  fork_label: string | null;
  sentence_length_avg: number | null;
  sentence_length_variance: number | null;
  paragraph_length_avg: number | null;
  paragraph_length_variance: number | null;
  formality_score: number | null;
  punctuation_style: Record<string, number>;
  emoji_signature: { count: number; per_1000_words: number };
  register: string | null;
  vocabulary_signature: string | null;
  opening_patterns: string[];
  closing_patterns: string[];
  idiosyncratic_phrases: string[];
  avoided_phrases: string[];
  summary: string | null;
  extraction_model: string;
  extraction_confidence: number | null;
  samples_count: number;
}

// the timeline read shape: a camelCase view of one snapshot row.
export interface VoiceSnapshot {
  id: string;
  capturedAt: string; // iso ... the timeline x-axis
  source: string;
  forkLabel: string | null;
  sentenceLengthAvg: number | null;
  sentenceLengthVariance: number | null;
  paragraphLengthAvg: number | null;
  formalityScore: number | null;
  punctuationStyle: Record<string, number>;
  emojiSignature: { count: number; per_1000_words: number };
  register: string | null;
  vocabularySignature: string | null;
  openingPatterns: string[];
  closingPatterns: string[];
  idiosyncraticPhrases: string[];
  avoidedPhrases: string[];
  summary: string | null;
  extractionModel: string;
  extractionConfidence: number | null;
  samplesCount: number;
}

const SNAPSHOT_COLUMNS =
  "id, captured_at, source, fork_label, sentence_length_avg, sentence_length_variance, paragraph_length_avg, formality_score, punctuation_style, emoji_signature, register, vocabulary_signature, opening_patterns, closing_patterns, idiosyncratic_phrases, avoided_phrases, summary, extraction_model, extraction_confidence, samples_count";

// the _avg columns are integer (mirroring saveWriterVoice's roundOrNull, which
// is private to that module) ... reimplemented inline so this stays pure with no
// server-only import.
function roundOrNull(n: number | null): number | null {
  return n === null ? null : Math.round(n);
}

// defensive narrow for a jsonb string-array column read back from a row.
function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

function asNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && !Number.isNaN(v)) out[k] = v;
  }
  return out;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function asEmoji(value: unknown): { count: number; per_1000_words: number } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    return {
      count: typeof o.count === "number" ? o.count : 0,
      per_1000_words: typeof o.per_1000_words === "number" ? o.per_1000_words : 0,
    };
  }
  return { count: 0, per_1000_words: 0 };
}

/**
 * PURE: map a freshly-distilled ExtractedVoice into the denormalized snapshot
 * insert payload. rounds the _avg fields (integer columns), keeps variance,
 * freezes the jsonb blobs verbatim, stamps provenance. by construction it emits
 * NO outreach_* key ... SnapshotInsert only has nova's columns. no db / server /
 * ai imports, so it's unit-tested with zero mocks (the x-ray rhythm). captured_at
 * is the saveWriterVoice nowIso, so a snapshot and its voice_profiles row agree
 * to the second. created_at/updated_at are LEFT to their column defaults ... the
 * payload never writes them, so the table stays append-only from app code.
 */
export function extractedVoiceToSnapshot(
  userId: string,
  v: ExtractedVoice,
  capturedAtIso: string,
): SnapshotInsert {
  return {
    user_id: userId,
    captured_at: capturedAtIso,
    source: "extraction",
    fork_label: null,
    sentence_length_avg: roundOrNull(v.stats.sentence_length_avg),
    sentence_length_variance: v.stats.sentence_length_variance,
    paragraph_length_avg: roundOrNull(v.stats.paragraph_length_avg),
    paragraph_length_variance: v.stats.paragraph_length_variance,
    formality_score: v.formality_score,
    punctuation_style: v.stats.punctuation_style,
    emoji_signature: v.stats.emoji_signature,
    register: v.register,
    vocabulary_signature: v.vocabulary_signature,
    opening_patterns: v.opening_patterns,
    closing_patterns: v.closing_patterns,
    idiosyncratic_phrases: v.idiosyncratic_phrases,
    avoided_phrases: v.avoided_phrases,
    summary: v.summary,
    // v.model is always cfg.modelId (a string); the ?? is belt-and-suspenders so
    // a future nullable model can't fail the NOT NULL and silently lose the dot.
    extraction_model: v.model ?? "unknown",
    extraction_confidence: v.confidence,
    samples_count: v.samples_count,
  };
}

/**
 * best-effort, NON-FATAL capture. the live voice_profiles upsert is the source
 * of truth; the snapshot is bonus history, so this NEVER throws ... a history
 * hiccup can't turn the train-my-voice click into a 502. it swallows + reports.
 */
export async function insertVoiceSnapshot(
  client: ServerClient,
  userId: string,
  v: ExtractedVoice,
  capturedAtIso: string,
): Promise<void> {
  try {
    const typed = client as unknown as TypedClient;
    const payload = extractedVoiceToSnapshot(userId, v, capturedAtIso);
    const { error } = await typed.from("np_voice_snapshots").insert(payload);
    if (error) reportError(new Error(error.message), { tag: "voice-snapshot-failed", userId });
  } catch (err) {
    reportError(err, { tag: "voice-snapshot-failed", userId });
  }
}

/**
 * the timeline read: a writer's snapshots, newest-first. RLS scopes to the
 * caller's own rows. returns [] on any error ... a history read never throws,
 * and a malformed historical row is narrowed defensively rather than crashing
 * the library render.
 */
export async function listVoiceSnapshots(
  client: ServerClient,
  userId: string,
  limit = 60,
  // an OPTIONAL fork lens. undefined (the default) adds NO predicate, so the
  // query chain stays byte-identical to chunk-1/2 (eq -> order -> limit) and the
  // existing call sites + their test mock are untouched. a string narrows to that
  // named strand; the explicit null sentinel narrows to "your voice"
  // (fork_label IS NULL). the (user_id, fork_label, captured_at DESC) index serves
  // the filtered read directly.
  forkFilter?: string | null,
): Promise<VoiceSnapshot[]> {
  try {
    const typed = client as unknown as TypedClient;
    let query = typed.from("np_voice_snapshots").select(SNAPSHOT_COLUMNS).eq("user_id", userId);
    if (forkFilter !== undefined) {
      query =
        forkFilter === null ? query.is("fork_label", null) : query.eq("fork_label", forkFilter);
    }
    const { data, error } = await query.order("captured_at", { ascending: false }).limit(limit);
    if (error || !data) return [];
    return (data as unknown as Record<string, unknown>[]).map(rowToSnapshot);
  } catch {
    return [];
  }
}

/**
 * name (or un-name) a strand: set fork_label on the writer's OWN snapshot rows.
 * the ONLY write chunk 3 adds, and the ONLY mutation the longitudinal self ever
 * makes to a snapshot. it touches the single metadata TAG the v0_4_0 migration
 * shipped (with its np_voice_snapshots_update_own RLS policy) expressly for this:
 * the frozen stats (the y-axes, the jsonb fingerprints, register, provenance) are
 * physically unreachable because the update payload is the lone key { fork_label }.
 * it NEVER opens voice_profiles, so the live writing voice (partner / ghost /
 * repurpose, which read voice_profiles) can't move ... this is a pure read-time
 * lens. owner-scoped by .eq('user_id') over the RLS USING/WITH CHECK. non-fatal
 * (the panel posture): returns { ok: false } on any error instead of throwing.
 */
export async function setSnapshotForkLabel(
  client: ServerClient,
  userId: string,
  snapshotIds: string[],
  label: string | null,
): Promise<{ ok: boolean }> {
  // an empty id list would be a 0-row update postgres accepts as success ... guard
  // it so "named nothing" can never masquerade as ok.
  if (snapshotIds.length === 0) return { ok: false };
  try {
    const typed = client as unknown as TypedClient;
    const { error } = await typed
      .from("np_voice_snapshots")
      .update({ fork_label: label })
      .eq("user_id", userId)
      .in("id", snapshotIds);
    if (error) {
      reportError(new Error(error.message), { tag: "voice-fork-label-failed", userId });
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    reportError(err, { tag: "voice-fork-label-failed", userId });
    return { ok: false };
  }
}

function rowToSnapshot(r: Record<string, unknown>): VoiceSnapshot {
  return {
    id: String(r.id),
    capturedAt: String(r.captured_at),
    source: typeof r.source === "string" ? r.source : "extraction",
    forkLabel: typeof r.fork_label === "string" ? r.fork_label : null,
    sentenceLengthAvg: numOrNull(r.sentence_length_avg),
    sentenceLengthVariance: numOrNull(r.sentence_length_variance),
    paragraphLengthAvg: numOrNull(r.paragraph_length_avg),
    formalityScore: numOrNull(r.formality_score),
    punctuationStyle: asNumberRecord(r.punctuation_style),
    emojiSignature: asEmoji(r.emoji_signature),
    register: typeof r.register === "string" ? r.register : null,
    vocabularySignature: typeof r.vocabulary_signature === "string" ? r.vocabulary_signature : null,
    openingPatterns: asStringList(r.opening_patterns),
    closingPatterns: asStringList(r.closing_patterns),
    idiosyncraticPhrases: asStringList(r.idiosyncratic_phrases),
    avoidedPhrases: asStringList(r.avoided_phrases),
    summary: typeof r.summary === "string" ? r.summary : null,
    extractionModel: typeof r.extraction_model === "string" ? r.extraction_model : "unknown",
    extractionConfidence: numOrNull(r.extraction_confidence),
    samplesCount: typeof r.samples_count === "number" ? r.samples_count : 0,
  };
}
