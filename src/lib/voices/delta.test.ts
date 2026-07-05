import { describe, expect, it } from "vitest";

import {
  deltaIsEmpty,
  deltaToFields,
  deltaToOverrides,
  normalizeVoiceDelta,
  rowToDelta,
} from "./delta";

describe("normalizeVoiceDelta", () => {
  it("requires a name", () => {
    const r = normalizeVoiceDelta({ summary: "clipped and cold" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/name/);
  });

  it("normalizes + bounds the fields, deduping lists case-insensitively", () => {
    const r = normalizeVoiceDelta({
      name: "  the detective  ",
      summary: "world-weary,   talks in questions",
      register: "hardboiled",
      idiosyncraticPhrases: ["see", "SEE", "kid"],
      avoidedPhrases: "lovely\nlovely\nmarvelous",
      sentenceLengthTarget: 7,
      formalityTarget: 0.2,
    });
    expect(r.ok).toBe(true);
    const d = r.delta!;
    expect(d.name).toBe("the detective");
    expect(d.summary).toBe("world-weary, talks in questions");
    expect(d.idiosyncraticPhrases).toEqual(["see", "kid"]);
    expect(d.avoidedPhrases).toEqual(["lovely", "marvelous"]);
    expect(d.sentenceLengthTarget).toBe(7);
    expect(d.formalityTarget).toBe(0.2);
  });

  it("clamps out-of-band numeric targets and drops non-numeric ones", () => {
    expect(
      normalizeVoiceDelta({ name: "x", sentenceLengthTarget: 9999 }).delta!.sentenceLengthTarget,
    ).toBe(80);
    expect(
      normalizeVoiceDelta({ name: "x", sentenceLengthTarget: 0 }).delta!.sentenceLengthTarget,
    ).toBe(2);
    expect(normalizeVoiceDelta({ name: "x", formalityTarget: 5 }).delta!.formalityTarget).toBe(1);
    expect(
      normalizeVoiceDelta({ name: "x", sentenceLengthTarget: "wide" }).delta!.sentenceLengthTarget,
    ).toBeNull();
  });

  it("keeps exemplars' inner punctuation but trims + dedupes them", () => {
    const d = normalizeVoiceDelta({
      name: "x",
      exemplars: [
        "  the rain never stopped, not once.  ",
        "the rain never stopped, not once.",
        "who's asking?",
      ],
    }).delta!;
    expect(d.exemplars).toEqual(["the rain never stopped, not once.", "who's asking?"]);
  });
});

describe("deltaIsEmpty", () => {
  it("is true for a name-only delta, false once anything is set", () => {
    const bare = normalizeVoiceDelta({ name: "the ghost" }).delta!;
    expect(deltaIsEmpty(bare)).toBe(true);
    const steered = normalizeVoiceDelta({ name: "the ghost", register: "hushed" }).delta!;
    expect(deltaIsEmpty(steered)).toBe(false);
  });
});

describe("deltaToFields", () => {
  it("maps the summary onto writing_overrides.summary (the composer's lead slot)", () => {
    const d = normalizeVoiceDelta({ name: "x", summary: "terse", register: "gruff" }).delta!;
    const f = deltaToFields(d);
    expect(f.register).toBe("gruff");
    expect(f.writing_overrides).toEqual({ summary: "terse" });
    expect(f.active_for_writing).toBe(true);
  });

  it("leaves writing_overrides undefined when there's no summary", () => {
    const d = normalizeVoiceDelta({ name: "x", register: "gruff" }).delta!;
    expect(deltaToFields(d).writing_overrides).toBeUndefined();
  });

  it("maps the numeric targets through so they steer the prompt", () => {
    const d = normalizeVoiceDelta({
      name: "x",
      sentenceLengthTarget: 8,
      formalityTarget: 0.3,
    }).delta!;
    const f = deltaToFields(d);
    expect(f.sentence_length_avg).toBe(8);
    expect(f.formality_score).toBe(0.3);
  });
});

describe("overrides round-trip", () => {
  it("rowToDelta(deltaToOverrides) recovers the delta", () => {
    const original = normalizeVoiceDelta({
      name: "the child",
      summary: "wide-eyed, short sentences",
      register: "innocent",
      vocabularySignature: "small words",
      openingPatterns: ["and then"],
      idiosyncraticPhrases: ["really really"],
      exemplars: ["and then the dog ran away."],
      sentenceLengthTarget: 5,
      formalityTarget: 0.1,
    }).delta!;
    const recovered = rowToDelta({
      name: "the child",
      register: "innocent",
      summary: "wide-eyed, short sentences",
      overrides: deltaToOverrides(original),
    });
    expect(recovered).toEqual(original);
  });

  it("rowToDelta tolerates a corrupt / missing overrides blob", () => {
    const d = rowToDelta({
      name: "salvage",
      register: 5,
      summary: null,
      overrides: "not-an-object",
    });
    expect(d.name).toBe("salvage");
    expect(d.openingPatterns).toEqual([]);
    expect(d.sentenceLengthTarget).toBeNull();
  });
});
