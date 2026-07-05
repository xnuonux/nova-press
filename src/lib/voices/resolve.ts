// pure voice overlay for multi-voice: measure how far a named DELTA (a character
// voice) pushes from the writer's BASE voice (the drift), GATE an over-divergent
// delta back so a character overlay can never fully erase the writer, and OVERLAY
// the delta onto the base's already-composed prompt line. the delta's steer is
// rendered by the SAME composeVoiceCompactView the prompt already uses. no db /
// server / ai-runtime imports (only the pure VoiceProfileFields + composer + the
// pure delta shape), so it's unit-tested headless.

import { composeVoiceCompactView, type VoiceProfileFields } from "@/lib/ai/voice-compact";

import { deltaIsEmpty, deltaToFields, type VoiceDelta } from "./delta";

// the structural shape of the prompt's voice slot (matches db/voice-profile's
// WriterVoice without importing that server-only module into this pure one).
export interface CompactVoice {
  voiceCompactView?: string;
  exemplars?: string[];
}

// a neutral sentence length to measure a target against when the base has no
// average yet (an untrained writer). ~17 words is a calm prose default.
const NEUTRAL_SENTENCE_LEN = 17;
// the drift each kind of override contributes, summed then bounded to [0,1].
const W_REGISTER = 0.28;
const W_VOCAB = 0.16;
const W_SUMMARY = 0.18;
const W_AVOID = 0.12;
const W_SIGNATURE = 0.12;
const W_PATTERNS = 0.12;
const W_SENTENCE = 0.34; // a far sentence-length target is the biggest divergence
const W_FORMALITY = 0.22;

/**
 * how far the delta pushes the resolved voice from the base, in [0,1]. it sums the
 * weight of each field the delta overrides, plus a magnitude term for how far the
 * sentence-length / formality targets sit from the base (or a neutral default when
 * the base is untrained). 0 = a name-only delta (the narrator), 1 = a total
 * rewrite. pure, base-tolerant (an empty base just means the targets measure
 * against the neutral defaults).
 */
export function voiceDrift(base: VoiceProfileFields, delta: VoiceDelta): number {
  if (deltaIsEmpty(delta)) return 0;
  let drift = 0;
  if (delta.register) drift += W_REGISTER;
  if (delta.vocabularySignature) drift += W_VOCAB;
  if (delta.summary) drift += W_SUMMARY;
  if (delta.avoidedPhrases.length > 0) drift += W_AVOID;
  if (delta.idiosyncraticPhrases.length > 0) drift += W_SIGNATURE;
  if (delta.openingPatterns.length > 0 || delta.closingPatterns.length > 0) drift += W_PATTERNS;

  if (delta.sentenceLengthTarget !== null && delta.sentenceLengthTarget > 0) {
    const baseLen =
      typeof base.sentence_length_avg === "number" && base.sentence_length_avg > 0
        ? base.sentence_length_avg
        : NEUTRAL_SENTENCE_LEN;
    // measure the shift in LOG space so it's symmetric: a 2x lengthening and a 1/2x
    // shortening both read as a full sentence-drift term (|log2(2)| = |log2(0.5)| = 1),
    // matching the intent that halving a voice is as divergent as doubling it.
    const ratioGap = Math.min(1, Math.abs(Math.log2(delta.sentenceLengthTarget / baseLen)));
    drift += W_SENTENCE * ratioGap;
  }
  if (delta.formalityTarget !== null) {
    const baseFormality = 0.5; // neutral; the base formality_score isn't in scope here
    drift += W_FORMALITY * Math.min(1, Math.abs(delta.formalityTarget - baseFormality) / 0.5);
  }
  return Math.min(1, drift);
}

// past this, a delta has stopped being an overlay and is overwriting the writer.
// the gate clamps it back so the narrator's anchor always shows through.
export const DRIFT_CEILING = 0.8;

export interface GatedDelta {
  delta: VoiceDelta;
  drift: number;
  clamped: boolean;
}

/**
 * gate the delta to the base: if its drift exceeds the ceiling, drop its
 * heaviest-but-least-essential overrides ... in order: the pattern lists, then the
 * numeric targets (formality, then sentence length), then the avoided list ...
 * until it's back under the ceiling, so the resolved voice always keeps the
 * writer's anchor. the voice's IDENTITY fields (name, summary, register, vocabulary
 * signature) are never clamped ... they're the point of the voice. deterministic +
 * total (the identity weights sum to at most 0.74, under the 0.8 ceiling, so the
 * shed loop always converges). returns the (possibly clamped) delta plus the final
 * drift and whether anything was dropped.
 */
export function gateDelta(base: VoiceProfileFields, delta: VoiceDelta): GatedDelta {
  let working = delta;
  let drift = voiceDrift(base, working);
  if (drift <= DRIFT_CEILING) return { delta: working, drift, clamped: false };

  // shed the non-identity overrides in this order until under the ceiling.
  const shedders: ((d: VoiceDelta) => VoiceDelta)[] = [
    (d) => ({ ...d, openingPatterns: [], closingPatterns: [] }),
    (d) => ({ ...d, formalityTarget: null }),
    (d) => ({ ...d, sentenceLengthTarget: null }),
    (d) => ({ ...d, avoidedPhrases: [] }),
  ];
  for (const shed of shedders) {
    working = shed(working);
    drift = voiceDrift(base, working);
    if (drift <= DRIFT_CEILING) break;
  }
  return { delta: working, drift, clamped: true };
}

/**
 * overlay the delta onto the writer's already-composed base voice for the prompt
 * slot. the delta's steer is rendered by the SAME composeVoiceCompactView (via
 * deltaToFields), then framed as "speaking as <name>" with the base kept as the
 * anchor underneath, so generation stays the writer's hand wearing a mask, never a
 * different writer. exemplars: the delta's lead, then the base's, de-duped +
 * bounded to 3. a name-only (empty) delta returns the base untouched. pure.
 */
export function applyVoiceDelta(base: CompactVoice, delta: VoiceDelta): CompactVoice {
  if (deltaIsEmpty(delta)) return base;
  const steer = composeVoiceCompactView(deltaToFields(delta));
  const anchor = base.voiceCompactView?.trim();
  let voiceCompactView: string | undefined;
  if (steer && anchor) {
    voiceCompactView = `speaking as ${delta.name}: ${steer}. (anchored to the writer's own voice: ${anchor})`;
  } else if (steer) {
    voiceCompactView = `speaking as ${delta.name}: ${steer}`;
  } else {
    voiceCompactView = anchor;
  }
  const exemplars: string[] = [];
  const seen = new Set<string>();
  for (const e of [...delta.exemplars, ...(base.exemplars ?? [])]) {
    const v = e.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    exemplars.push(v);
    if (exemplars.length >= 3) break;
  }
  return {
    voiceCompactView,
    exemplars: exemplars.length ? exemplars : undefined,
  };
}
