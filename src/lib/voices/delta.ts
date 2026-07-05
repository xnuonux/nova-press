// pure delta-voice shape for multi-voice. a work holds a CAST of voices: the
// writer's resolved base voice is the narrator, and each named delta voice (e.g.
// "the detective", "the ghost") is a SPARSE overlay on top of it ... only the
// fields it sets diverge from the base. a delta maps to / from the np_voices row
// (name + register + summary are columns, the rest rides the `overrides` jsonb)
// and to the VoiceProfileFields shape the prompt composer already reads. no db /
// server / ai imports, so it's unit-tested headless. mirrors infobox.ts / lexeme.ts.

import type { VoiceProfileFields } from "@/lib/ai/voice-compact";

export interface VoiceDelta {
  // the voice's name ... the only hard requirement (it's the label + the steer).
  name: string;
  // a one-line steer, the writer's plain-language description of the voice.
  summary: string;
  register: string;
  vocabularySignature: string;
  openingPatterns: string[];
  closingPatterns: string[];
  idiosyncraticPhrases: string[];
  avoidedPhrases: string[];
  exemplars: string[];
  // optional numeric targets, null when unset (so the base value carries through).
  sentenceLengthTarget: number | null;
  // 0..1, how formal this voice runs relative to neutral; null when unset.
  formalityTarget: number | null;
}

export interface VoiceDeltaDraft {
  name?: unknown;
  summary?: unknown;
  register?: unknown;
  vocabularySignature?: unknown;
  openingPatterns?: unknown;
  closingPatterns?: unknown;
  idiosyncraticPhrases?: unknown;
  avoidedPhrases?: unknown;
  exemplars?: unknown;
  sentenceLengthTarget?: unknown;
  formalityTarget?: unknown;
}

const MAX_NAME = 80;
const MAX_LINE = 200;
const MAX_SUMMARY = 600;
const MAX_LIST = 12;
const MAX_EXEMPLARS = 3;
// a sentence-length target outside this band is noise, not a voice.
const MIN_SENTENCE_TARGET = 2;
const MAX_SENTENCE_TARGET = 80;

function clean(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

// a multi-line / comma list cleaned, de-duped (case-insensitive), bounded.
function cleanList(input: unknown, maxItem: number, maxCount: number): string[] {
  let raw: unknown[];
  if (Array.isArray(input)) raw = input;
  else if (typeof input === "string") raw = input.split(/[\n,]/);
  else return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const v = clean(item, maxItem);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= maxCount) break;
  }
  return out;
}

// exemplars keep their internal punctuation (they're real lines), only the outer
// whitespace is trimmed; still de-duped + bounded.
function cleanExemplars(input: unknown): string[] {
  let raw: unknown[];
  if (Array.isArray(input)) raw = input;
  else if (typeof input === "string") raw = input.split(/\n/);
  else return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const v = item.trim().slice(0, MAX_LINE).trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= MAX_EXEMPLARS) break;
  }
  return out;
}

// a finite number clamped to [lo, hi], or null for anything else (NaN, strings,
// out-of-band). keeps a target honest without throwing.
function clampNumber(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

export interface VoiceDeltaResult {
  ok: boolean;
  delta?: VoiceDelta;
  error?: string;
}

/** validate + normalize a draft into a writable delta voice, or a calm reason. the
 *  name is the only hard requirement; the rest are optional + bounded. */
export function normalizeVoiceDelta(draft: VoiceDeltaDraft): VoiceDeltaResult {
  const name = clean(draft.name, MAX_NAME);
  if (!name) return { ok: false, error: "a voice needs a name." };
  return {
    ok: true,
    delta: {
      name,
      summary: clean(draft.summary, MAX_SUMMARY),
      register: clean(draft.register, MAX_LINE),
      vocabularySignature: clean(draft.vocabularySignature, MAX_LINE),
      openingPatterns: cleanList(draft.openingPatterns, MAX_LINE, MAX_LIST),
      closingPatterns: cleanList(draft.closingPatterns, MAX_LINE, MAX_LIST),
      idiosyncraticPhrases: cleanList(draft.idiosyncraticPhrases, MAX_LINE, MAX_LIST),
      avoidedPhrases: cleanList(draft.avoidedPhrases, MAX_LINE, MAX_LIST),
      exemplars: cleanExemplars(draft.exemplars),
      sentenceLengthTarget: clampNumber(
        draft.sentenceLengthTarget,
        MIN_SENTENCE_TARGET,
        MAX_SENTENCE_TARGET,
      ),
      formalityTarget: clampNumber(draft.formalityTarget, 0, 1),
    },
  };
}

/** does the delta actually steer anything beyond its name? a name-only delta is a
 *  label with no overlay ... generation should treat it as the narrator. */
export function deltaIsEmpty(d: VoiceDelta): boolean {
  return (
    !d.summary &&
    !d.register &&
    !d.vocabularySignature &&
    d.openingPatterns.length === 0 &&
    d.closingPatterns.length === 0 &&
    d.idiosyncraticPhrases.length === 0 &&
    d.avoidedPhrases.length === 0 &&
    d.exemplars.length === 0 &&
    d.sentenceLengthTarget === null &&
    d.formalityTarget === null
  );
}

/** the delta as the VoiceProfileFields shape the compact composer reads, so the
 *  delta's steer line is built by the SAME composeVoiceCompactView the base uses.
 *  the summary rides writing_overrides.summary (the manual-steer slot the composer
 *  leads with). */
export function deltaToFields(d: VoiceDelta): VoiceProfileFields {
  return {
    register: d.register || null,
    vocabulary_signature: d.vocabularySignature || null,
    sentence_length_avg: d.sentenceLengthTarget,
    formality_score: d.formalityTarget,
    avoided_phrases: d.avoidedPhrases,
    idiosyncratic_phrases: d.idiosyncraticPhrases,
    opening_patterns: d.openingPatterns,
    closing_patterns: d.closingPatterns,
    writing_overrides: d.summary ? { summary: d.summary } : undefined,
    active_for_writing: true,
  };
}

/** the jsonb `overrides` payload stored on the np_voices row (name / register /
 *  summary are their own columns, so they're excluded here). */
export function deltaToOverrides(d: VoiceDelta): Record<string, unknown> {
  return {
    vocabularySignature: d.vocabularySignature,
    openingPatterns: d.openingPatterns,
    closingPatterns: d.closingPatterns,
    idiosyncraticPhrases: d.idiosyncraticPhrases,
    avoidedPhrases: d.avoidedPhrases,
    exemplars: d.exemplars,
    sentenceLengthTarget: d.sentenceLengthTarget,
    formalityTarget: d.formalityTarget,
  };
}

/** read a stored np_voices row back into a delta (tolerant of partial / legacy
 *  rows). name / register / summary come from the columns, the rest from the
 *  `overrides` jsonb. runs through normalize so the same bounds always hold. */
export function rowToDelta(row: {
  name?: unknown;
  register?: unknown;
  summary?: unknown;
  overrides?: unknown;
}): VoiceDelta {
  const ov =
    row.overrides && typeof row.overrides === "object" && !Array.isArray(row.overrides)
      ? (row.overrides as Record<string, unknown>)
      : {};
  const result = normalizeVoiceDelta({
    name: row.name,
    register: row.register,
    summary: row.summary,
    vocabularySignature: ov.vocabularySignature,
    openingPatterns: ov.openingPatterns,
    closingPatterns: ov.closingPatterns,
    idiosyncraticPhrases: ov.idiosyncraticPhrases,
    avoidedPhrases: ov.avoidedPhrases,
    exemplars: ov.exemplars,
    sentenceLengthTarget: ov.sentenceLengthTarget,
    formalityTarget: ov.formalityTarget,
  });
  // a row with a blank name shouldn't exist (the db requires it), but degrade to a
  // safe placeholder rather than throwing on a corrupt read.
  return (
    result.delta ?? {
      name: clean(row.name, MAX_NAME) || "a voice",
      summary: "",
      register: "",
      vocabularySignature: "",
      openingPatterns: [],
      closingPatterns: [],
      idiosyncraticPhrases: [],
      avoidedPhrases: [],
      exemplars: [],
      sentenceLengthTarget: null,
      formalityTarget: null,
    }
  );
}
