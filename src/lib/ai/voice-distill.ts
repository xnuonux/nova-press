/**
 * voice distill ... the qualitative half of voice extraction, kept pure so the
 * fiddly part (parsing the model's json out of whatever it actually returned)
 * is unit-tested. the server side (lib/ai/voice-extract) owns the model call;
 * this owns the prompt + the defensive parse.
 */

export interface DistilledVoice {
  register: string | null;
  vocabulary_signature: string | null;
  opening_patterns: string[];
  closing_patterns: string[];
  idiosyncratic_phrases: string[];
  avoided_phrases: string[];
  formality_score: number | null;
  // the one compact line a writing assistant mirrors (-> writing_overrides.summary)
  summary: string | null;
  // 2-3 short real in-voice lines (-> writing_overrides.exemplars, the prompt slot)
  exemplars: string[];
  confidence: number;
}

export const EMPTY_DISTILL: DistilledVoice = {
  register: null,
  vocabulary_signature: null,
  opening_patterns: [],
  closing_patterns: [],
  idiosyncratic_phrases: [],
  avoided_phrases: [],
  formality_score: null,
  summary: null,
  exemplars: [],
  confidence: 0,
};

// the analyst prompt. nova reads a writer's OWN finished pieces and returns the
// fingerprint of their voice, not a summary of the content, as strict json.
export const VOICE_EXTRACT_SYSTEM = [
  "you are nova's voice analyst. you read a writer's own finished pieces and distill the fingerprint of their voice ... not what they wrote, how they write.",
  "output STRICT JSON ONLY. no prose, no markdown, no code fences. exactly this shape:",
  '{"register": string, "vocabulary_signature": string, "opening_patterns": string[], "closing_patterns": string[], "idiosyncratic_phrases": string[], "avoided_phrases": string[], "formality_score": number, "summary": string, "exemplars": string[], "confidence": number}',
  "field guide: register = a short phrase for their tone (e.g. 'wry and direct', 'warm, plainspoken'). vocabulary_signature = the texture of their word choice. opening_patterns / closing_patterns = how their sentences and pieces tend to start and end (2-4 each). idiosyncratic_phrases = signature moves they actually use (up to 6). avoided_phrases = clichés they steer clear of (up to 6; infer if unclear). formality_score = 0 (casual) to 1 (formal). summary = ONE compact line a writing assistant could mirror. exemplars = 2-3 SHORT real sentences lifted from the samples that best carry the voice. confidence = 0..1 for how much signal the samples gave.",
  "lowercase everything. no em-dashes (use ...).",
].join("\n\n");

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim())
    .slice(0, max);
}

function asStr(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asScore(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}

// pull the voice json out of the model's reply, however it wrapped it (fences,
// stray prose). a parse failure degrades to EMPTY_DISTILL ... extraction must
// never throw, it just falls back to stats-only.
export function parseDistillation(text: string): DistilledVoice {
  try {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return EMPTY_DISTILL;
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    return {
      register: asStr(obj.register),
      vocabulary_signature: asStr(obj.vocabulary_signature),
      opening_patterns: asStringArray(obj.opening_patterns, 4),
      closing_patterns: asStringArray(obj.closing_patterns, 4),
      idiosyncratic_phrases: asStringArray(obj.idiosyncratic_phrases, 6),
      avoided_phrases: asStringArray(obj.avoided_phrases, 6),
      formality_score: asScore(obj.formality_score),
      summary: asStr(obj.summary),
      exemplars: asStringArray(obj.exemplars, 3),
      confidence: asScore(obj.confidence) ?? 0,
    };
  } catch {
    return EMPTY_DISTILL;
  }
}
