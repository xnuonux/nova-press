import { describe, expect, it } from "vitest";

import type { VoiceProfileFields } from "@/lib/ai/voice-compact";

import { normalizeVoiceDelta } from "./delta";
import { applyVoiceDelta, DRIFT_CEILING, gateDelta, voiceDrift } from "./resolve";

const base: VoiceProfileFields = {
  register: "literary",
  vocabulary_signature: "lyrical, latinate",
  sentence_length_avg: 22,
  idiosyncratic_phrases: ["the thing is"],
  opening_patterns: ["it began"],
  avoided_phrases: ["very"],
  active_for_writing: true,
};

describe("voiceDrift", () => {
  it("is 0 for a name-only delta", () => {
    expect(voiceDrift(base, normalizeVoiceDelta({ name: "x" }).delta!)).toBe(0);
  });

  it("grows as the delta overrides more, capped at 1", () => {
    const light = normalizeVoiceDelta({ name: "x", register: "gruff" }).delta!;
    const heavy = normalizeVoiceDelta({
      name: "x",
      register: "gruff",
      vocabularySignature: "monosyllabic",
      summary: "barks orders",
      avoidedPhrases: ["please"],
      idiosyncraticPhrases: ["now"],
      openingPatterns: ["listen"],
      sentenceLengthTarget: 4,
      formalityTarget: 0,
    }).delta!;
    const dl = voiceDrift(base, light);
    const dh = voiceDrift(base, heavy);
    expect(dl).toBeGreaterThan(0);
    expect(dh).toBeGreaterThan(dl);
    expect(dh).toBeLessThanOrEqual(1);
  });

  it("a far sentence-length target drifts more than a near one", () => {
    const near = normalizeVoiceDelta({ name: "x", sentenceLengthTarget: 20 }).delta!; // base is 22
    const far = normalizeVoiceDelta({ name: "x", sentenceLengthTarget: 4 }).delta!;
    expect(voiceDrift(base, far)).toBeGreaterThan(voiceDrift(base, near));
  });
});

describe("gateDelta", () => {
  it("passes a modest delta through untouched", () => {
    const delta = normalizeVoiceDelta({ name: "x", register: "gruff", summary: "terse" }).delta!;
    const g = gateDelta(base, delta);
    expect(g.clamped).toBe(false);
    expect(g.delta).toEqual(delta);
    expect(g.drift).toBeLessThanOrEqual(DRIFT_CEILING);
  });

  it("clamps an over-divergent delta back under the ceiling, keeping identity fields", () => {
    const delta = normalizeVoiceDelta({
      name: "the detective",
      register: "hardboiled",
      vocabularySignature: "monosyllabic",
      summary: "world-weary, talks in questions",
      avoidedPhrases: ["lovely"],
      idiosyncraticPhrases: ["see, kid"],
      openingPatterns: ["listen"],
      closingPatterns: ["case closed"],
    }).delta!;
    expect(voiceDrift(base, delta)).toBeGreaterThan(DRIFT_CEILING);
    const g = gateDelta(base, delta);
    expect(g.clamped).toBe(true);
    expect(g.drift).toBeLessThanOrEqual(DRIFT_CEILING);
    // identity fields survive the clamp ...
    expect(g.delta.register).toBe("hardboiled");
    expect(g.delta.summary).toBe("world-weary, talks in questions");
    expect(g.delta.idiosyncraticPhrases).toEqual(["see, kid"]);
    // ... the heavy non-identity overrides are shed.
    expect(g.delta.openingPatterns).toEqual([]);
    expect(g.delta.closingPatterns).toEqual([]);
  });
});

describe("applyVoiceDelta", () => {
  const compactBase = {
    voiceCompactView: "register: literary. sentences run about 22 words",
    exemplars: ["the old house exhaled."],
  };

  it("frames the delta as a mask over the anchored base voice", () => {
    const delta = normalizeVoiceDelta({
      name: "the detective",
      summary: "world-weary",
      register: "hardboiled",
    }).delta!;
    const out = applyVoiceDelta(compactBase, delta);
    expect(out.voiceCompactView).toContain("speaking as the detective");
    expect(out.voiceCompactView).toContain("anchored to the writer's own voice");
    expect(out.voiceCompactView).toContain("hardboiled");
  });

  it("leads with the delta's exemplars, then the base's, bounded to 3", () => {
    const delta = normalizeVoiceDelta({
      name: "x",
      summary: "terse",
      exemplars: ["who's asking?", "the rain never stopped."],
    }).delta!;
    const out = applyVoiceDelta(compactBase, delta);
    expect(out.exemplars).toEqual([
      "who's asking?",
      "the rain never stopped.",
      "the old house exhaled.",
    ]);
  });

  it("returns the base untouched for a name-only delta", () => {
    const bare = normalizeVoiceDelta({ name: "x" }).delta!;
    expect(applyVoiceDelta(compactBase, bare)).toBe(compactBase);
  });

  it("carries the formality steer into the compact line", () => {
    const delta = normalizeVoiceDelta({ name: "x", formalityTarget: 0.1 }).delta!;
    const out = applyVoiceDelta(compactBase, delta);
    expect(out.voiceCompactView).toContain("plainspoken");
  });

  it("de-dupes exemplars across the delta + base, case-insensitively", () => {
    const delta = normalizeVoiceDelta({
      name: "x",
      summary: "terse",
      exemplars: ["The old house exhaled.", "who's asking?"],
    }).delta!;
    const out = applyVoiceDelta(compactBase, delta);
    // the base's "the old house exhaled." is the same line (different case) ... once.
    expect(out.exemplars).toEqual(["The old house exhaled.", "who's asking?"]);
  });
});
