import { describe, expect, it } from "vitest";

import { composeVoiceCompactView } from "./voice-compact";

describe("composeVoiceCompactView", () => {
  it("returns undefined for an empty profile (keeps the not-yet-trained fallback)", () => {
    expect(composeVoiceCompactView({})).toBeUndefined();
  });

  it("returns undefined when the writer turned voice-mirroring off", () => {
    expect(
      composeVoiceCompactView({ register: "casual", active_for_writing: false }),
    ).toBeUndefined();
  });

  it("renders the register", () => {
    expect(composeVoiceCompactView({ register: "casual and direct" })).toBe(
      "register: casual and direct",
    );
  });

  it("rounds the average sentence length", () => {
    expect(composeVoiceCompactView({ sentence_length_avg: 13.6 })).toBe(
      "sentences run about 14 words",
    );
  });

  it("renders the vocabulary signature", () => {
    expect(composeVoiceCompactView({ vocabulary_signature: "plain, concrete, anglo-saxon" })).toBe(
      "vocabulary: plain, concrete, anglo-saxon",
    );
  });

  it("lists signature phrases and avoided phrases", () => {
    const out = composeVoiceCompactView({
      idiosyncratic_phrases: ["here's the thing", "and that's the point"],
      avoided_phrases: ["utilize", "leverage"],
    });
    expect(out).toContain("signature phrases: here's the thing, and that's the point");
    expect(out).toContain("never writes: utilize, leverage");
  });

  it("leads with the manual writing override", () => {
    const out = composeVoiceCompactView({
      register: "casual",
      writing_overrides: { summary: "short fragments, lots of white space" },
    });
    expect(out?.startsWith("short fragments, lots of white space")).toBe(true);
    expect(out).toContain("register: casual");
  });

  it("reads opening_patterns when it's a string list, ignores it otherwise", () => {
    expect(
      composeVoiceCompactView({ opening_patterns: ["a short declarative", "a question"] }),
    ).toBe("tends to open with: a short declarative; a question");
    // a non-list json shape must not crash or leak [object Object].
    expect(composeVoiceCompactView({ opening_patterns: { weird: true } })).toBeUndefined();
  });

  it("caps signature phrases at 6 and openings at 3", () => {
    const out = composeVoiceCompactView({
      idiosyncratic_phrases: ["a", "b", "c", "d", "e", "f", "g", "h"],
      opening_patterns: ["1", "2", "3", "4", "5"],
    });
    expect(out).toContain("signature phrases: a, b, c, d, e, f");
    expect(out).not.toContain(", g");
    expect(out).toContain("tends to open with: 1; 2; 3");
    expect(out).not.toContain("; 4");
  });

  it("joins multiple clauses with '. '", () => {
    const out = composeVoiceCompactView({
      register: "wry",
      sentence_length_avg: 9,
      vocabulary_signature: "spare",
    });
    expect(out).toBe("register: wry. sentences run about 9 words. vocabulary: spare");
  });
});
