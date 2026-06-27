import { describe, expect, it } from "vitest";

import {
  countSyllables,
  establishedMeter,
  groupVerse,
  lastWord,
  lineSyllables,
  rhymeKey,
  rhymes,
  type VerseBlock,
} from "./poetry";

describe("countSyllables", () => {
  it("counts short words as one", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("a")).toBe(1);
  });

  it("counts vowel groups for longer words", () => {
    expect(countSyllables("apple")).toBe(2);
    expect(countSyllables("running")).toBe(2);
    expect(countSyllables("beautiful")).toBe(3);
  });

  it("drops a silent trailing e", () => {
    expect(countSyllables("stone")).toBe(1);
    expect(countSyllables("table")).toBe(2); // -le keeps its syllable
  });

  it("is empty for a non-word", () => {
    expect(countSyllables("...")).toBe(0);
    expect(countSyllables("")).toBe(0);
  });
});

describe("lineSyllables", () => {
  it("sums the words of a line", () => {
    expect(lineSyllables("the cat sat")).toBe(3);
    expect(lineSyllables("")).toBe(0);
  });
});

describe("rhyme", () => {
  it("takes the rhyme key from the last word's final vowel onward", () => {
    expect(rhymeKey("the dark night")).toBe("ight");
    expect(rhymeKey("by the light of the moon")).toBe("oon");
    expect(rhymeKey("")).toBe("");
  });

  it("matches end-rhymes and rejects non-rhymes", () => {
    expect(rhymes("the dark night", "a pure delight")).toBe(true);
    expect(rhymes("the moon", "the sun")).toBe(false);
    expect(rhymes("nothing here", "")).toBe(false);
  });

  it("reads the last word", () => {
    expect(lastWord("the dark night")).toBe("night");
    expect(lastWord("  ")).toBe("");
  });
});

describe("groupVerse", () => {
  const v = (text: string, index: number): VerseBlock => ({ type: "verse_line", text, index });
  const p = (text: string, index: number): VerseBlock => ({ type: "p", text, index });

  it("groups a run of verse lines into one stanza", () => {
    const poems = groupVerse([v("line one", 0), v("line two", 1), v("line three", 2)]);
    expect(poems).toHaveLength(1);
    expect(poems[0]!.stanzas).toHaveLength(1);
    expect(poems[0]!.stanzas[0]!.lines.map((l) => l.text)).toEqual([
      "line one",
      "line two",
      "line three",
    ]);
  });

  it("splits stanzas on an empty paragraph between two verse runs", () => {
    const poems = groupVerse([
      v("a one", 0),
      v("a two", 1),
      p("", 2),
      v("b one", 3),
      v("b two", 4),
    ]);
    expect(poems).toHaveLength(1);
    expect(poems[0]!.stanzas).toHaveLength(2);
    expect(poems[0]!.stanzas[0]!.lines).toHaveLength(2);
    expect(poems[0]!.stanzas[1]!.lines).toHaveLength(2);
  });

  it("splits stanzas on an empty verse line too", () => {
    const poems = groupVerse([v("a one", 0), v("", 1), v("b one", 2)]);
    expect(poems[0]!.stanzas).toHaveLength(2);
  });

  it("ends a poem at a non-empty prose block", () => {
    const poems = groupVerse([v("verse one", 0), p("a prose paragraph", 1), v("verse two", 2)]);
    expect(poems).toHaveLength(2);
  });

  it("finds no poems in plain prose", () => {
    expect(groupVerse([p("just prose", 0), p("more prose", 1)])).toEqual([]);
    expect(groupVerse([])).toEqual([]);
  });

  it("carries each line's syllable count + original block index", () => {
    const poems = groupVerse([v("the cat sat", 5)]);
    expect(poems[0]!.stanzas[0]!.lines[0]).toMatchObject({ index: 5, syllables: 3 });
  });
});

describe("establishedMeter", () => {
  const line = (syllables: number) => ({ index: 0, text: "", syllables });

  it("returns the modal count when a meter is established", () => {
    expect(establishedMeter([line(8), line(8), line(8), line(6)])).toBe(8);
  });

  it("stays quiet for free verse (no dominant count)", () => {
    expect(establishedMeter([line(5), line(9), line(13), line(7)])).toBeNull();
  });

  it("needs at least three lines to call a meter", () => {
    expect(establishedMeter([line(8), line(8)])).toBeNull();
  });
});
