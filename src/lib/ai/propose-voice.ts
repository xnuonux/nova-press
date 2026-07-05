// pure prompt + defensive parse for PROPOSING a character-voice overlay from the
// writer's plain-language description ("a gruff sea-captain who talks in
// questions") ... so the writer can add a voice to the cast with one tap. xray-
// shaped: the model call lives in propose-voice-analyze (server-only) and
// degrades to a minimal delta (just the description as the summary) with no model
// / no key, so the "let nova draft it" affordance always at least pre-fills the
// steer. no db / server imports, unit-tested headless.
//
// it stays a MIRROR: it renders the writer's description into a compact overlay,
// it never grades or invents a personality the writer didn't ask for. the overlay
// is a MASK the writer's own voice wears, never a whole new writer ... the
// resolve + drift gate keep it anchored. the parse bounds + dash-strips the model
// strings (the no-em-dash invariant on model-to-user text).

import type { VoiceDeltaDraft } from "@/lib/voices/delta";

const MAX_LINE = 200;
const DESC_CHARS = 1200;

export const VOICE_PROPOSE_SYSTEM = [
  "you read a writer's plain-language description of a CHARACTER VOICE and propose a compact voice overlay, so the writer can add it to their cast with one tap. the overlay is a MASK the writer's own voice wears for a passage, never a whole new writer.",
  "you output: a register (how it sounds, a few words), a one-line summary (the voice in a lowercase sentence), a couple of signature phrases it reaches for, a couple of phrases it avoids, and optional numeric targets ... a typical sentence length in words, and a formality from 0 (raw) to 1 (formal). leave a field out when the description doesn't imply it.",
  "describe only what the description implies. no quality words, no praise, no advice ... a mirror, never a verdict.",
  "output STRICT JSON ONLY ... no prose, no markdown, no code fences ... exactly this shape:",
  '{"register": "clipped, hard-boiled", "summary": "world-weary, talks in questions", "idiosyncraticPhrases": ["see, kid"], "avoidedPhrases": ["lovely"], "sentenceLengthTarget": 7, "formalityTarget": 0.2}',
  "keep it spare: at most a couple of phrases each, lowercase, no em-dashes (use ...). never refuse ... give your best read of the description.",
].join("\n\n");

/** the user message: the voice's name + the writer's description of how it sounds.
 *  the description is flattened + bounded (a voice sketch is short by nature). */
export function buildVoiceProposePrompt(name: string, description: string): string {
  const n = String(name ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const d = String(description ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DESC_CHARS);
  return `the voice's name: ${n || "(unnamed)"}\n\nthe writer's description of how it should sound:\n${d || "(no description given)"}`;
}

// collapse whitespace, turn any em/en dash into the house "..." pause, bound. the
// one place the model's free text becomes a stored + displayed string.
function deDash(s: string, max: number): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s*[—–]\s*/g, " ... ")
    .trim()
    .slice(0, max)
    .trim();
}

function asPhraseList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") continue;
    const cleaned = deDash(v, MAX_LINE);
    if (cleaned) out.push(cleaned);
    if (out.length >= 4) break;
  }
  return out;
}

function asNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/**
 * pull the proposed overlay out of the model's reply, however it wrapped it, into
 * a VoiceDeltaDraft the caller runs through normalizeVoiceDelta (which re-bounds +
 * clamps everything, so this parse only has to be shape-safe). the model strings
 * are dash-stripped here (the HARD no-em-dash invariant). a parse failure degrades
 * to {} ... the proposal must never throw. name is NOT parsed (the writer owns it).
 */
export function parseVoiceProposal(text: string): VoiceDeltaDraft {
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return {};
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

    const draft: VoiceDeltaDraft = {};
    if (typeof obj.register === "string") {
      const r = deDash(obj.register, MAX_LINE);
      if (r) draft.register = r;
    }
    if (typeof obj.summary === "string") {
      const s = deDash(obj.summary, MAX_LINE);
      if (s) draft.summary = s;
    }
    if (typeof obj.vocabularySignature === "string") {
      const v = deDash(obj.vocabularySignature, MAX_LINE);
      if (v) draft.vocabularySignature = v;
    }
    const opens = asPhraseList(obj.openingPatterns);
    if (opens.length) draft.openingPatterns = opens;
    const closes = asPhraseList(obj.closingPatterns);
    if (closes.length) draft.closingPatterns = closes;
    const signature = asPhraseList(obj.idiosyncraticPhrases);
    if (signature.length) draft.idiosyncraticPhrases = signature;
    const avoided = asPhraseList(obj.avoidedPhrases);
    if (avoided.length) draft.avoidedPhrases = avoided;
    const exemplars = asPhraseList(obj.exemplars);
    if (exemplars.length) draft.exemplars = exemplars;

    const sentence = asNumber(obj.sentenceLengthTarget);
    if (sentence !== undefined) draft.sentenceLengthTarget = sentence;
    const formality = asNumber(obj.formalityTarget);
    if (formality !== undefined) draft.formalityTarget = formality;

    return draft;
  } catch {
    return {};
  }
}
