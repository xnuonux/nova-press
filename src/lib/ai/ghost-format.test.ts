import { describe, expect, it } from "vitest";

import { joinGhost, lineCut, paragraphCut, sentenceCut } from "./ghost-format";

describe("sentenceCut", () => {
  it("returns -1 while no boundary has arrived", () => {
    expect(sentenceCut("the light here is")).toBe(-1);
    expect(sentenceCut("")).toBe(-1);
  });

  it("cuts inclusively, right after a sentence-ending mark", () => {
    expect(sentenceCut("she walked away.")).toBe("she walked away.".length);
    expect(sentenceCut("really?")).toBe("really?".length);
    expect(sentenceCut("stop!")).toBe("stop!".length);
  });

  it("keeps streaming past our '...' pause, never treating it as an end", () => {
    expect(sentenceCut("the light ... soft and low")).toBe(-1);
  });

  it("cuts at the real period that follows a '...' pause", () => {
    const s = "the light ... soft and low.";
    expect(sentenceCut(s)).toBe(s.length);
  });

  it("stops at a hard newline (exclusive) when it comes first", () => {
    expect(sentenceCut("a new thought\nand more.")).toBe("a new thought".length);
  });

  it("prefers the sentence end when it lands before a newline", () => {
    expect(sentenceCut("done here. then\nmore")).toBe("done here.".length);
  });

  it("cuts only the first of several sentences", () => {
    expect(sentenceCut("first one. second one.")).toBe("first one.".length);
  });
});

describe("paragraphCut", () => {
  it("returns -1 while a beat has no paragraph break", () => {
    expect(paragraphCut("the ferryman waited at the dock all night.")).toBe(-1);
    expect(paragraphCut("")).toBe(-1);
  });

  it("does not cut on a lone newline inside a beat", () => {
    expect(paragraphCut("a line\nstill the same beat")).toBe(-1);
  });

  it("cuts (exclusive) at the first blank-line paragraph break", () => {
    const s = "first beat\n\nsecond beat";
    expect(paragraphCut(s)).toBe("first beat".length);
    expect(s.slice(0, paragraphCut(s))).toBe("first beat");
  });

  it("treats a whitespace-only line as a paragraph break", () => {
    expect(paragraphCut("beat one\n \nbeat two")).toBe("beat one".length);
    expect(paragraphCut("beat one\n\t\nbeat two")).toBe("beat one".length);
  });

  it("cuts at the FIRST break when several arrive", () => {
    expect(paragraphCut("one\n\ntwo\n\nthree")).toBe("one".length);
  });
});

describe("lineCut", () => {
  it("returns -1 while a single line has no break", () => {
    expect(lineCut("a coined line of verse")).toBe(-1);
    expect(lineCut("")).toBe(-1);
  });

  it("cuts at the first hard line break", () => {
    expect(lineCut("the silver moon hung low\nand a second line")).toBe(
      "the silver moon hung low".length,
    );
  });

  it("skips a leading newline so the cut still lands after real content", () => {
    // a model that opens with a stray newline must not disable the line-stop.
    expect(lineCut("\nthe moon hangs low\nand more")).toBe("\nthe moon hangs low".length);
    expect(lineCut("  \n  the moon hangs low\nand more")).toBe("  \n  the moon hangs low".length);
    expect(lineCut("\nthe moon hangs low")).toBe(-1); // only a leading break, no real break yet
  });
});

describe("joinGhost", () => {
  it("returns empty for empty or whitespace-only input", () => {
    expect(joinGhost("ctx", "")).toBe("");
    expect(joinGhost("ctx", "   ")).toBe("");
  });

  it("adds one leading space after a word", () => {
    expect(joinGhost("the reader", "wants more")).toBe(" wants more");
  });

  it("does not double the space when the line already ends in one", () => {
    expect(joinGhost("the reader ", "wants more")).toBe("wants more");
  });

  it("leads before an opening quote (straight or curly) or bracket", () => {
    expect(joinGhost("she said", '"yes"')).toBe(' "yes"');
    expect(joinGhost("she said", "“yes”")).toBe(" “yes”");
    expect(joinGhost("its", "‘kind’")).toBe(" ‘kind’");
    expect(joinGhost("note", "[a]")).toBe(" [a]");
    expect(joinGhost("note", "(a)")).toBe(" (a)");
  });

  it("does not lead before closing punctuation or a pause", () => {
    expect(joinGhost("the reader", ", and then")).toBe(", and then");
    expect(joinGhost("the reader", "... a pause")).toBe("... a pause");
  });

  it("strips a leading space and collapses a boundary double space", () => {
    expect(joinGhost("the reader", "  wants  more")).toBe(" wants more");
  });

  it("adds no lead when there is no preceding context", () => {
    expect(joinGhost("", "opening line")).toBe("opening line");
  });
});
