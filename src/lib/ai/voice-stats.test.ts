import { describe, expect, it } from "vitest";

import { extractVoiceStats } from "./voice-stats";

describe("extractVoiceStats", () => {
  it("returns null lengths for empty input", () => {
    const s = extractVoiceStats([]);
    expect(s.sentence_length_avg).toBeNull();
    expect(s.paragraph_length_avg).toBeNull();
    expect(s.emoji_signature.count).toBe(0);
  });

  it("computes average sentence length in words", () => {
    // two sentences: 3 words, then 5 words -> avg 4
    const s = extractVoiceStats(["one two three. four five six seven eight."]);
    expect(s.sentence_length_avg).toBe(4);
  });

  it("does not split a sentence on a '...' pause", () => {
    // one sentence with an ellipsis pause -> 6 words, one sentence
    const s = extractVoiceStats(["the room waited ... then it glowed."]);
    expect(s.sentence_length_avg).toBe(6);
  });

  it("counts paragraphs by blank lines", () => {
    // 3 words, then 2 words -> avg 2.5
    const s = extractVoiceStats(["a b c.\n\nd e."]);
    expect(s.paragraph_length_avg).toBe(2.5);
  });

  it("reports punctuation as a per-1000-word rate", () => {
    const s = extractVoiceStats(["yes, and, also, more words here now ok done."]);
    expect(s.punctuation_style.comma).toBeGreaterThan(0);
    expect(s.punctuation_style.semicolon).toBe(0);
  });

  it("counts emoji and reports a rate", () => {
    const s = extractVoiceStats(["the muse arrives 🌅 at golden hour."]);
    expect(s.emoji_signature.count).toBe(1);
    expect(s.emoji_signature.per_1000_words).toBeGreaterThan(0);
  });
});
