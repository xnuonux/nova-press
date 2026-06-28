import { describe, expect, it } from "vitest";

import { isPartOfSpeech, lexemeToRecord, normalizeLexeme, recordToLexeme } from "./lexeme";

describe("isPartOfSpeech", () => {
  it("accepts the known parts of speech, rejects others", () => {
    expect(isPartOfSpeech("noun")).toBe(true);
    expect(isPartOfSpeech("verb")).toBe(true);
    expect(isPartOfSpeech("gerund")).toBe(false);
    expect(isPartOfSpeech(7)).toBe(false);
  });
});

describe("normalizeLexeme", () => {
  it("requires a headword", () => {
    const out = normalizeLexeme({ headword: "  ", gloss: "water" });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/headword/);
  });

  it("normalizes a full draft, trimming + collapsing whitespace", () => {
    const out = normalizeLexeme({
      headword: "  kanta ",
      partOfSpeech: "noun",
      gloss: "the   deep  water",
      ipa: "ˈkan.ta",
    });
    expect(out.ok).toBe(true);
    expect(out.lexeme).toEqual({
      headword: "kanta",
      partOfSpeech: "noun",
      gloss: "the deep water",
      ipa: "ˈkan.ta",
    });
  });

  it("defaults an unknown part of speech to 'other'", () => {
    const out = normalizeLexeme({ headword: "ka", partOfSpeech: "wizard" });
    expect(out.lexeme!.partOfSpeech).toBe("other");
  });

  it("bounds the fields", () => {
    const out = normalizeLexeme({
      headword: "x".repeat(200),
      gloss: "y".repeat(1000),
      ipa: "z".repeat(500),
    });
    expect(out.lexeme!.headword.length).toBeLessThanOrEqual(60);
    expect(out.lexeme!.gloss.length).toBeLessThanOrEqual(240);
    expect(out.lexeme!.ipa.length).toBeLessThanOrEqual(80);
  });
});

describe("record round-trip", () => {
  it("stores the gloss on senses and reads it back", () => {
    const lex = { headword: "kanta", partOfSpeech: "noun" as const, gloss: "deep water", ipa: "" };
    const record = lexemeToRecord(lex);
    expect(record).toEqual({
      headword: "kanta",
      partOfSpeech: "noun",
      senses: ["deep water"],
      ipa: "",
    });
    expect(recordToLexeme(record)).toEqual(lex);
  });

  it("reads a partial / legacy record tolerantly", () => {
    expect(recordToLexeme({ headword: "ka" })).toEqual({
      headword: "ka",
      partOfSpeech: "other",
      gloss: "",
      ipa: "",
    });
    expect(recordToLexeme(null)).toEqual({
      headword: "",
      partOfSpeech: "other",
      gloss: "",
      ipa: "",
    });
  });

  it("falls back to a `gloss` field when there are no senses", () => {
    expect(recordToLexeme({ headword: "ka", gloss: "to go" }).gloss).toBe("to go");
  });

  it("empties the senses list for an empty gloss", () => {
    expect(
      lexemeToRecord({ headword: "ka", partOfSpeech: "other", gloss: "", ipa: "" }).senses,
    ).toEqual([]);
  });
});
