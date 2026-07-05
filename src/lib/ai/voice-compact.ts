/**
 * voice compact view ... distills the writer's voice_profiles row into the one
 * compact line nova's prompts already have a slot for (buildPartnerPrompt's
 * voiceCompactView, the repurpose engine's compact block). this is the seam
 * that turns nova from a GPT-wrapper into the voice-mirror it's built to be:
 * before this, every prompt fell back to "not yet trained".
 *
 * pure (no db / server / ai imports) so it's fully unit-tested and the read
 * layer (lib/db/voice-profile) just hands it a row. the columns it reads are
 * exactly the ones CLAUDE.md lets nova read off the shared voice_profiles
 * table ... it never touches gen connect's outreach_* columns.
 */

// the readable subset of a voice_profiles row. json columns come in as unknown
// because their shape is owned upstream; the helpers below narrow defensively.
export interface VoiceProfileFields {
  register?: string | null;
  vocabulary_signature?: string | null;
  sentence_length_avg?: number | null;
  // 0 (raw / informal) .. 1 (formal / composed); rendered as a steer band when set.
  formality_score?: number | null;
  avoided_phrases?: string[] | null;
  idiosyncratic_phrases?: string[] | null;
  opening_patterns?: unknown;
  closing_patterns?: unknown;
  writing_overrides?: unknown;
  // nova's column ... false means the writer turned voice-mirroring off.
  active_for_writing?: boolean | null;
}

// a json value that's a plain string, or an array of strings, becomes a string
// list; everything else is dropped. shields the prompt from upstream shape
// drift in opening_patterns / closing_patterns.
function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
  }
  if (typeof value === "string" && value.trim().length > 0) return [value.trim()];
  return [];
}

// pull a named string field out of a json object (e.g. writing_overrides.summary).
function pickString(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const v = (obj as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function cleanList(list: string[] | null | undefined, max: number): string[] {
  return (list ?? [])
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
}

/**
 * build the compact voice line, or undefined when there's nothing real to say
 * (no profile, or the writer turned mirroring off) ... undefined lets the
 * prompt keep its honest "not yet trained" fallback instead of injecting noise.
 */
export function composeVoiceCompactView(p: VoiceProfileFields): string | undefined {
  if (p.active_for_writing === false) return undefined;

  const clauses: string[] = [];

  // nova's manual override leads ... it's the writer's explicit steer and
  // outranks the extracted stats.
  const override =
    pickString(p.writing_overrides, "summary") ?? pickString(p.writing_overrides, "note");
  if (override) clauses.push(override);

  if (typeof p.register === "string" && p.register.trim())
    clauses.push(`register: ${p.register.trim()}`);

  if (typeof p.sentence_length_avg === "number" && p.sentence_length_avg > 0) {
    clauses.push(`sentences run about ${Math.round(p.sentence_length_avg)} words`);
  }

  if (typeof p.formality_score === "number" && p.formality_score >= 0 && p.formality_score <= 1) {
    const f = p.formality_score;
    clauses.push(
      f < 0.34
        ? "leans plainspoken + informal"
        : f > 0.66
          ? "leans formal + composed"
          : "balanced formality",
    );
  }

  if (typeof p.vocabulary_signature === "string" && p.vocabulary_signature.trim()) {
    clauses.push(`vocabulary: ${p.vocabulary_signature.trim()}`);
  }

  const opens = asStringList(p.opening_patterns).slice(0, 3);
  if (opens.length) clauses.push(`tends to open with: ${opens.join("; ")}`);

  const closes = asStringList(p.closing_patterns).slice(0, 3);
  if (closes.length) clauses.push(`tends to close with: ${closes.join("; ")}`);

  const signature = cleanList(p.idiosyncratic_phrases, 6);
  if (signature.length) clauses.push(`signature phrases: ${signature.join(", ")}`);

  const avoided = cleanList(p.avoided_phrases, 6);
  if (avoided.length) clauses.push(`never writes: ${avoided.join(", ")}`);

  if (clauses.length === 0) return undefined;
  return clauses.join(". ");
}
