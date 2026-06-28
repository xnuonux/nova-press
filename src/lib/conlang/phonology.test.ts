import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHONOLOGY,
  classOf,
  isLegalWord,
  normalizePhonology,
  segmentPhonemes,
  type Phonology,
} from "./phonology";

describe("normalizePhonology", () => {
  it("falls back to the default on empty / junk", () => {
    expect(normalizePhonology(null)).toEqual(DEFAULT_PHONOLOGY);
    expect(normalizePhonology({})).toEqual(DEFAULT_PHONOLOGY);
    expect(normalizePhonology({ consonants: [], vowels: [], syllables: [] })).toEqual(
      DEFAULT_PHONOLOGY,
    );
  });

  it("parses arrays + de-dupes + lowercases", () => {
    const p = normalizePhonology({
      consonants: ["T", "t", "k"],
      vowels: ["A", "a"],
      syllables: ["cv", "CV"],
    });
    expect(p.consonants).toEqual(["t", "k"]);
    expect(p.vowels).toEqual(["a"]);
    expect(p.syllables).toEqual(["CV"]);
  });

  it("parses whitespace/comma strings too", () => {
    const p = normalizePhonology({ consonants: "p t k", vowels: "a, i", syllables: "CV CVC" });
    expect(p.consonants).toEqual(["p", "t", "k"]);
    expect(p.vowels).toEqual(["a", "i"]);
    expect(p.syllables).toEqual(["CV", "CVC"]);
  });

  it("strips non-CV chars from a template and drops a blank one", () => {
    const p = normalizePhonology({
      consonants: ["t"],
      vowels: ["a"],
      syllables: ["C-V", "xyz", "CV"],
    });
    // "C-V" -> "CV", "xyz" -> "" (dropped), "CV" dup of the first -> dropped.
    expect(p.syllables).toEqual(["CV"]);
  });

  it("keeps a phoneme listed in both classes as a consonant", () => {
    const p = normalizePhonology({ consonants: ["y"], vowels: ["y", "a"], syllables: ["CV"] });
    expect(p.consonants).toContain("y");
    expect(p.vowels).not.toContain("y");
  });
});

describe("segmentPhonemes (maximal munch)", () => {
  const p: Phonology = { consonants: ["t", "th"], vowels: ["a"], syllables: ["CV", "CVC"] };

  it("prefers a digraph over its parts", () => {
    expect(segmentPhonemes(p, "tha")).toEqual(["th", "a"]);
  });

  it("segments single phonemes", () => {
    expect(segmentPhonemes(p, "ta")).toEqual(["t", "a"]);
  });

  it("returns null on an unknown sound", () => {
    expect(segmentPhonemes(DEFAULT_PHONOLOGY, "xa")).toBeNull();
    expect(segmentPhonemes(DEFAULT_PHONOLOGY, "")).toBeNull();
  });
});

describe("classOf", () => {
  it("classifies consonants and vowels, null otherwise", () => {
    expect(classOf(DEFAULT_PHONOLOGY, "k")).toBe("C");
    expect(classOf(DEFAULT_PHONOLOGY, "a")).toBe("V");
    expect(classOf(DEFAULT_PHONOLOGY, "z")).toBeNull();
  });
});

describe("isLegalWord", () => {
  it("passes a CV / CVC / V word", () => {
    expect(isLegalWord(DEFAULT_PHONOLOGY, "ka")).toBe(true);
    expect(isLegalWord(DEFAULT_PHONOLOGY, "kan")).toBe(true);
    expect(isLegalWord(DEFAULT_PHONOLOGY, "a")).toBe(true);
    expect(isLegalWord(DEFAULT_PHONOLOGY, "kanta")).toBe(true); // kan + ta
  });

  it("rejects an illegal onset cluster (CCV) when only CV/CVC/V are allowed", () => {
    expect(isLegalWord(DEFAULT_PHONOLOGY, "kta")).toBe(false);
  });

  it("rejects an unknown sound", () => {
    expect(isLegalWord(DEFAULT_PHONOLOGY, "xa")).toBe(false);
  });

  it("rejects an empty word", () => {
    expect(isLegalWord(DEFAULT_PHONOLOGY, "")).toBe(false);
    expect(isLegalWord(DEFAULT_PHONOLOGY, "   ")).toBe(false);
  });

  it("rejects a bare vowel when V is not an allowed template", () => {
    const noBareV: Phonology = { consonants: ["k"], vowels: ["a"], syllables: ["CV"] };
    expect(isLegalWord(noBareV, "a")).toBe(false);
    expect(isLegalWord(noBareV, "ka")).toBe(true);
  });

  it("reads a digraph as one phoneme (maximal munch)", () => {
    const p: Phonology = { consonants: ["t", "th"], vowels: ["a"], syllables: ["CV"] };
    expect(isLegalWord(p, "tha")).toBe(true); // th + a = CV
    expect(isLegalWord(p, "ta")).toBe(true); // t + a = CV
    expect(isLegalWord(p, "tta")).toBe(false); // t + t + a = CCV, no cluster onset
  });

  it("needs DP, not greedy, to tile (CVC + CV over CVCV)", () => {
    const p: Phonology = { consonants: ["t"], vowels: ["a"], syllables: ["CVC", "CV"] };
    // "tata" = CVCV ... greedy CVC first strands a lone V; CV + CV tiles.
    expect(isLegalWord(p, "tata")).toBe(true);
  });
});
