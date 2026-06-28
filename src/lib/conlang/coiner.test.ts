import { describe, expect, it } from "vitest";

import { coinLegalWord, seededRng } from "./coiner";
import { DEFAULT_PHONOLOGY, isLegalWord, type Phonology } from "./phonology";

describe("seededRng", () => {
  it("is deterministic for a given seed", () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe("coinLegalWord", () => {
  it("always coins a non-empty word that is legal in the phonology", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const word = coinLegalWord(DEFAULT_PHONOLOGY, seededRng(seed));
      expect(word.length).toBeGreaterThan(0);
      expect(isLegalWord(DEFAULT_PHONOLOGY, word)).toBe(true);
    }
  });

  it("respects a digraph phonology (the maximal-munch retry guard holds)", () => {
    const p: Phonology = {
      consonants: ["t", "th", "s", "sh", "k"],
      vowels: ["a", "i"],
      syllables: ["CV", "CVC"],
    };
    for (let seed = 1; seed <= 40; seed += 1) {
      const word = coinLegalWord(p, seededRng(seed));
      expect(isLegalWord(p, word)).toBe(true);
    }
  });

  it("honors the maxSyllables bound", () => {
    // a single-syllable CV phonology: every word is exactly 2 chars at maxSyllables 1.
    const p: Phonology = { consonants: ["k"], vowels: ["a"], syllables: ["CV"] };
    const word = coinLegalWord(p, seededRng(7), { maxSyllables: 1 });
    expect(word).toBe("ka");
  });
});
