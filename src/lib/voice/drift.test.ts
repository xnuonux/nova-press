import { describe, expect, it } from "vitest";

import type { VoiceSnapshot } from "@/lib/db/voice-snapshots";

import {
  computeSignaturePhraseDrift,
  computeVoiceDrift,
  delta,
  formatDriftForPrompt,
} from "./drift";

function snap(partial: Partial<VoiceSnapshot> & { capturedAt: string }): VoiceSnapshot {
  return {
    id: partial.id ?? partial.capturedAt,
    capturedAt: partial.capturedAt,
    source: "extraction",
    forkLabel: null,
    sentenceLengthAvg: partial.sentenceLengthAvg ?? null,
    sentenceLengthVariance: null,
    paragraphLengthAvg: null,
    formalityScore: partial.formalityScore ?? null,
    punctuationStyle: partial.punctuationStyle ?? {},
    emojiSignature: { count: 0, per_1000_words: 0 },
    register: partial.register ?? null,
    vocabularySignature: null,
    openingPatterns: [],
    closingPatterns: [],
    idiosyncraticPhrases: partial.idiosyncraticPhrases ?? [],
    avoidedPhrases: partial.avoidedPhrases ?? [],
    summary: null,
    extractionModel: "m",
    extractionConfidence: partial.extractionConfidence ?? null,
    samplesCount: partial.samplesCount ?? 0,
  };
}

describe("delta", () => {
  it("is stable within epsilon, moves beyond it", () => {
    expect(delta(10, 10.4, 0.5)).toEqual({ delta: 0.4, direction: "stable" });
    expect(delta(10, 10.6, 0.5)).toEqual({ delta: 0.6, direction: "up" });
    expect(delta(10, 9.4, 0.5)).toEqual({ delta: -0.6, direction: "down" });
  });

  it("never assumes zero or inverts when a side is null", () => {
    expect(delta(null, 10, 0.5)).toEqual({ delta: null, direction: "stable" });
    expect(delta(10, null, 0.5)).toEqual({ delta: null, direction: "stable" });
    expect(delta(null, null, 0.5)).toEqual({ delta: null, direction: "stable" });
  });

  it("decides formality at a 0.03 band", () => {
    expect(delta(0.41, 0.43, 0.03).direction).toBe("stable");
    expect(delta(0.41, 0.45, 0.03).direction).toBe("up");
  });
});

describe("computeVoiceDrift", () => {
  const older = snap({
    capturedAt: "2026-06-02T00:00:00Z",
    sentenceLengthAvg: 9,
    formalityScore: 0.41,
    punctuationStyle: { comma: 40, ellipsis: 4, semicolon: 2 },
    register: "wry, conversational",
    idiosyncraticPhrases: ["i think", "honestly"],
    avoidedPhrases: ["at the end of the day"],
    samplesCount: 3,
    extractionConfidence: 0.62,
  });
  const newer = snap({
    capturedAt: "2026-06-18T00:00:00Z",
    sentenceLengthAvg: 14,
    formalityScore: 0.38,
    punctuationStyle: { comma: 38, ellipsis: 9, semicolon: 0 },
    register: "punchy, direct",
    idiosyncraticPhrases: ["honestly", "look"],
    avoidedPhrases: ["at the end of the day"],
    samplesCount: 5,
    extractionConfidence: 0.81,
  });

  it("computes the headline deltas and directions", () => {
    const r = computeVoiceDrift(older, newer);
    expect(r.spanDays).toBe(16);
    expect(r.sentenceLength).toMatchObject({
      previous: 9,
      current: 14,
      delta: 5,
      direction: "longer",
    });
    expect(r.formality.direction).toBe("less formal");
    expect(r.formality.previous).toBe(0.41);
    expect(r.formality.current).toBe(0.38);
    expect(r.register.changed).toBe(true);
    // phrase set-diff: "i think" dropped, "look" gained; "honestly" stayed.
    expect(r.phrases.idiosyncratic.gained).toEqual(["look"]);
    expect(r.phrases.idiosyncratic.dropped).toEqual(["i think"]);
    expect(r.hasSignal).toBe(true);
  });

  it("is reproducible ... the same pair yields a byte-identical report", () => {
    expect(computeVoiceDrift(older, newer)).toEqual(computeVoiceDrift(older, newer));
  });

  it("sorts the pair internally, so order never inverts a direction", () => {
    const forward = computeVoiceDrift(older, newer);
    const reversed = computeVoiceDrift(newer, older);
    expect(reversed).toEqual(forward);
    expect(reversed.sentenceLength.direction).toBe("longer");
  });

  it("flags no signal for two near-identical readings", () => {
    const a = snap({
      capturedAt: "2026-06-02",
      sentenceLengthAvg: 10,
      formalityScore: 0.4,
      punctuationStyle: { comma: 30 },
    });
    const b = snap({
      capturedAt: "2026-06-09",
      sentenceLengthAvg: 10,
      formalityScore: 0.41,
      punctuationStyle: { comma: 30 },
    });
    const r = computeVoiceDrift(a, b);
    expect(r.hasSignal).toBe(false);
    expect(formatDriftForPrompt(r)).toContain("held steady");
  });

  it("renders 'not enough signal' for a null metric, never a fabricated zero", () => {
    const a = snap({
      capturedAt: "2026-06-02",
      sentenceLengthAvg: null,
      formalityScore: 0.4,
      punctuationStyle: { comma: 30 },
    });
    const b = snap({
      capturedAt: "2026-06-18",
      sentenceLengthAvg: 14,
      formalityScore: 0.6,
      punctuationStyle: { comma: 30 },
    });
    const r = computeVoiceDrift(a, b);
    expect(r.sentenceLength.delta).toBeNull();
    expect(formatDriftForPrompt(r)).toContain("sentence length: not enough signal");
  });

  it("treats a punctuation mark present-at-0 as a real measured rate, an absent key as null", () => {
    // semicolon present-at-0 in newer -> a real down move; ellipsis absent from
    // older's record entirely (hand-built) -> null, not a fabricated rate.
    const a = snap({ capturedAt: "2026-06-02", punctuationStyle: { semicolon: 3 } });
    const b = snap({ capturedAt: "2026-06-18", punctuationStyle: { semicolon: 0, ellipsis: 6 } });
    const r = computeVoiceDrift(a, b);
    expect(r.punctuation.semicolon).toMatchObject({
      previous: 3,
      current: 0,
      delta: -3,
      direction: "down",
    });
    expect(r.punctuation.ellipsis).toMatchObject({
      previous: null,
      current: 6,
      delta: null,
      direction: "stable",
    });
  });

  it("corrupt captured_at yields a null span, never a throw", () => {
    const a = snap({ capturedAt: "not-a-date", sentenceLengthAvg: 9 });
    const b = snap({ capturedAt: "2026-06-18", sentenceLengthAvg: 14 });
    expect(computeVoiceDrift(a, b).spanDays).toBeNull();
  });
});

describe("formatDriftForPrompt pre-rounding (defensive)", () => {
  it("forces a synthetic raw-precision value to its display form, so no raw digit reaches the model", () => {
    // nova's distill pipeline already rounds formality to 2dp, so this 4dp value
    // can't come from the real path ... the rounding is a DEFENSIVE wall against
    // any numeric source, proven reachable by injecting a synthetic raw value.
    const a = snap({ capturedAt: "2026-06-02", formalityScore: 0.5217, sentenceLengthAvg: 9 });
    const b = snap({ capturedAt: "2026-06-18", formalityScore: 0.83, sentenceLengthAvg: 14 });
    const block = formatDriftForPrompt(computeVoiceDrift(a, b));
    expect(block).toContain("0.52");
    expect(block).not.toContain("0.5217");
    expect(block).not.toContain("5217");
  });
});

describe("computeSignaturePhraseDrift", () => {
  it("keeps idiosyncratic and avoided diffs separate", () => {
    const a = snap({
      capturedAt: "2026-06-02",
      idiosyncraticPhrases: ["honestly"],
      avoidedPhrases: ["clearly"],
    });
    const b = snap({
      capturedAt: "2026-06-18",
      idiosyncraticPhrases: ["honestly", "look"],
      avoidedPhrases: [],
    });
    const d = computeSignaturePhraseDrift(a, b);
    expect(d.idiosyncratic.gained).toEqual(["look"]);
    expect(d.avoided.dropped).toEqual(["clearly"]);
    expect(d.avoided.gained).toEqual([]);
  });

  it("normalizes cosmetic churn but preserves the verbatim string", () => {
    const a = snap({ capturedAt: "2026-06-02", idiosyncraticPhrases: ["I think "] });
    const b = snap({ capturedAt: "2026-06-18", idiosyncraticPhrases: ["i think"] });
    const d = computeSignaturePhraseDrift(a, b);
    // same phrase modulo case/whitespace -> no spurious gained/dropped.
    expect(d.idiosyncratic.gained).toEqual([]);
    expect(d.idiosyncratic.dropped).toEqual([]);
  });
});
