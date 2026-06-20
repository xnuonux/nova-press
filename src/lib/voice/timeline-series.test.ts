import { describe, expect, it } from "vitest";

import type { VoiceSnapshot } from "@/lib/db/voice-snapshots";

import { buildTimelineSeries, metricValue, sortAscending } from "./timeline-series";

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
    register: null,
    vocabularySignature: null,
    openingPatterns: [],
    closingPatterns: [],
    idiosyncraticPhrases: [],
    avoidedPhrases: [],
    summary: null,
    extractionModel: "m",
    extractionConfidence: null,
    samplesCount: 0,
  };
}

describe("metricValue", () => {
  it("reads sentence length and formality straight off the snapshot", () => {
    const s = snap({ capturedAt: "2026-01-01", sentenceLengthAvg: 12, formalityScore: 0.4 });
    expect(metricValue(s, "sentence_length")).toBe(12);
    expect(metricValue(s, "formality")).toBe(0.4);
  });

  it("sums the punctuation fingerprint, null when there's none", () => {
    const s = snap({ capturedAt: "2026-01-01", punctuationStyle: { comma: 30, colon: 5 } });
    expect(metricValue(s, "punctuation")).toBe(35);
    expect(metricValue(snap({ capturedAt: "2026-01-01" }), "punctuation")).toBeNull();
  });
});

describe("sortAscending", () => {
  it("orders oldest -> newest without mutating the input", () => {
    const input = [
      snap({ capturedAt: "2026-03-01" }),
      snap({ capturedAt: "2026-01-01" }),
      snap({ capturedAt: "2026-02-01" }),
    ];
    const out = sortAscending(input);
    expect(out.map((s) => s.capturedAt)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    // input untouched
    expect(input[0]?.capturedAt).toBe("2026-03-01");
  });
});

describe("buildTimelineSeries", () => {
  it("returns an empty series with no range for no snapshots", () => {
    const s = buildTimelineSeries([], "sentence_length");
    expect(s.points).toEqual([]);
    expect(s.hasRange).toBe(false);
    expect(s.min).toBe(0);
    expect(s.max).toBe(0);
  });

  it("centers a single point and shows no fake range", () => {
    const s = buildTimelineSeries(
      [snap({ capturedAt: "2026-01-01", sentenceLengthAvg: 14 })],
      "sentence_length",
    );
    expect(s.points).toHaveLength(1);
    expect(s.points[0]?.x).toBe(0.5);
    expect(s.points[0]?.y).toBe(0.5);
    expect(s.hasRange).toBe(false);
  });

  it("flattens a metric that never moves to the midline (no fake range)", () => {
    const s = buildTimelineSeries(
      [
        snap({ capturedAt: "2026-01-01", sentenceLengthAvg: 10 }),
        snap({ capturedAt: "2026-02-01", sentenceLengthAvg: 10 }),
      ],
      "sentence_length",
    );
    expect(s.hasRange).toBe(false);
    expect(s.points.every((p) => p.y === 0.5)).toBe(true);
  });

  it("normalizes a moving metric to 0..1 across its range", () => {
    const s = buildTimelineSeries(
      [
        snap({ capturedAt: "2026-01-01", sentenceLengthAvg: 8 }),
        snap({ capturedAt: "2026-02-01", sentenceLengthAvg: 12 }),
        snap({ capturedAt: "2026-03-01", sentenceLengthAvg: 16 }),
      ],
      "sentence_length",
    );
    expect(s.hasRange).toBe(true);
    expect(s.min).toBe(8);
    expect(s.max).toBe(16);
    expect(s.points[0]?.y).toBe(0); // min
    expect(s.points[2]?.y).toBe(1); // max
    expect(s.points[1]?.y).toBeCloseTo(0.5, 5); // midpoint
  });

  it("spaces x by the real time gaps, not the index", () => {
    // jan 1, jan 2 (1 day), jan 11 (10 days) -> x = 0, 0.1, 1.0
    const s = buildTimelineSeries(
      [
        snap({ capturedAt: "2026-01-01T00:00:00Z", sentenceLengthAvg: 8 }),
        snap({ capturedAt: "2026-01-02T00:00:00Z", sentenceLengthAvg: 9 }),
        snap({ capturedAt: "2026-01-11T00:00:00Z", sentenceLengthAvg: 10 }),
      ],
      "sentence_length",
    );
    expect(s.points[0]?.x).toBeCloseTo(0, 5);
    expect(s.points[1]?.x).toBeCloseTo(0.1, 5);
    expect(s.points[2]?.x).toBeCloseTo(1, 5);
  });

  it("parks a missing value at the midline without breaking the range", () => {
    const s = buildTimelineSeries(
      [
        snap({ capturedAt: "2026-01-01", sentenceLengthAvg: 8 }),
        snap({ capturedAt: "2026-02-01" }), // no sentence length
        snap({ capturedAt: "2026-03-01", sentenceLengthAvg: 16 }),
      ],
      "sentence_length",
    );
    expect(s.min).toBe(8);
    expect(s.max).toBe(16);
    expect(s.points[1]?.value).toBeNull();
    expect(s.points[1]?.y).toBe(0.5);
  });
});
