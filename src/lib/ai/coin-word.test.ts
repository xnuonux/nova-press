import { describe, expect, it } from "vitest";

import { buildCoinWordPrompt, parseCoinWord } from "./coin-word";
import { DEFAULT_PHONOLOGY } from "@/lib/conlang/phonology";

describe("buildCoinWordPrompt", () => {
  it("carries the inventory, the syllable shapes, and the meaning", () => {
    const prompt = buildCoinWordPrompt(DEFAULT_PHONOLOGY, "deep water");
    expect(prompt).toContain("consonants (C):");
    expect(prompt).toContain("vowels (V):");
    expect(prompt).toContain("legal syllable shapes:");
    expect(prompt).toContain("CV");
    expect(prompt).toContain("the word should mean: deep water");
  });

  it("handles an empty meaning honestly", () => {
    expect(buildCoinWordPrompt(DEFAULT_PHONOLOGY, "")).toContain("coin any word that fits");
  });
});

describe("parseCoinWord", () => {
  it("pulls the bare word out", () => {
    expect(parseCoinWord("kanta")).toBe("kanta");
    expect(parseCoinWord("  Kanta\n")).toBe("kanta");
  });

  it("takes the first letter-run from a noisy reply", () => {
    expect(parseCoinWord('"melu"')).toBe("melu");
  });

  it("returns empty on no letters", () => {
    expect(parseCoinWord("123 !!!")).toBe("");
    expect(parseCoinWord("")).toBe("");
  });

  it("bounds the length", () => {
    expect(parseCoinWord("a".repeat(200)).length).toBeLessThanOrEqual(60);
  });
});
