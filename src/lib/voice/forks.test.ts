import { describe, expect, it } from "vitest";

import type { VoiceSnapshot } from "@/lib/db/voice-snapshots";

import { deriveForkRoster, normalizeForkLabel, resolveForkView } from "./forks";

function snap(id: string, forkLabel: string | null): VoiceSnapshot {
  return {
    id,
    capturedAt: id,
    source: "extraction",
    forkLabel,
    sentenceLengthAvg: null,
    sentenceLengthVariance: null,
    paragraphLengthAvg: null,
    formalityScore: null,
    punctuationStyle: {},
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

describe("resolveForkView", () => {
  it("returns the SAME array reference for the default null lens (the byte-identity gate)", () => {
    const all = [snap("a", null), snap("b", "morning")];
    // Object.is, not a copy ... this is what proves the default timeline is the
    // unchanged chunk-2 product.
    expect(resolveForkView(all, null)).toBe(all);
  });

  it("filters to a named strand, order preserved", () => {
    const all = [snap("a", null), snap("b", "morning"), snap("c", "morning"), snap("d", "essay")];
    expect(resolveForkView(all, "morning").map((s) => s.id)).toEqual(["b", "c"]);
  });

  it("returns [] for a strand with no members", () => {
    expect(resolveForkView([snap("a", null)], "ghost")).toEqual([]);
  });
});

describe("deriveForkRoster", () => {
  it("dedupes, excludes the null strand, keeps first-seen order", () => {
    const all = [snap("a", null), snap("b", "morning"), snap("c", "essay"), snap("d", "morning")];
    expect(deriveForkRoster(all)).toEqual(["morning", "essay"]);
  });

  it("is empty when nothing is named", () => {
    expect(deriveForkRoster([snap("a", null), snap("b", null)])).toEqual([]);
  });
});

describe("normalizeForkLabel", () => {
  it("collapses case + whitespace into one canonical strand key", () => {
    expect(normalizeForkLabel("Morning")).toBe("morning");
    expect(normalizeForkLabel("  morning  ")).toBe("morning");
    expect(normalizeForkLabel("morning   voice")).toBe("morning voice");
    expect(normalizeForkLabel("MORNING")).toBe("morning");
  });

  it("coerces empty / whitespace-only to null (un-name)", () => {
    expect(normalizeForkLabel("")).toBeNull();
    expect(normalizeForkLabel("   ")).toBeNull();
  });

  it("caps to 40 code points, counting astral characters correctly", () => {
    expect(normalizeForkLabel("a".repeat(50))).toHaveLength(40);
    // an emoji is one code point but two utf-16 units ... the cap must count
    // code points so the label can't exceed the postgres char_length CHECK.
    const out = normalizeForkLabel("🌅".repeat(45)) ?? "";
    expect(Array.from(out)).toHaveLength(40);
  });
});
