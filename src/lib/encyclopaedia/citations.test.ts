import { describe, expect, it } from "vitest";

import { collectCitations, splitOnCitations } from "./citations";

describe("collectCitations", () => {
  it("numbers citations in reading order", () => {
    const { footnotes } = collectCitations("a((first)) and b((second)).");
    expect(footnotes).toEqual([
      { number: 1, text: "first" },
      { number: 2, text: "second" },
    ]);
  });

  it("de-dupes identical citation text to one number", () => {
    const { runs, footnotes } = collectCitations(
      "a((Smith 1850)) b((Jones 1900)) c((smith 1850)).",
    );
    // smith 1850 repeats (case-insensitive) -> same number, one footnote.
    expect(footnotes).toHaveLength(2);
    expect(runs.map((r) => r.number)).toEqual([1, 2, 1]);
  });

  it("ignores a blank citation", () => {
    expect(collectCitations("x(( )) y").footnotes).toHaveLength(0);
  });

  it("collapses whitespace in the citation text", () => {
    expect(collectCitations("a((  the   source )) b").footnotes[0]!.text).toBe("the source");
  });

  it("returns nothing when there are no citations", () => {
    expect(collectCitations("plain prose, no marks.").footnotes).toEqual([]);
  });
});

describe("splitOnCitations", () => {
  it("splits text + cite segments and returns the footnotes", () => {
    const { segments, footnotes } = splitOnCitations("the gate((Smith)) is old.");
    expect(segments).toEqual([
      { kind: "text", value: "the gate" },
      { kind: "cite", number: 1, text: "Smith" },
      { kind: "text", value: " is old." },
    ]);
    expect(footnotes).toEqual([{ number: 1, text: "Smith" }]);
  });

  it("returns the whole text as one segment when there are no citations", () => {
    expect(splitOnCitations("nothing here").segments).toEqual([
      { kind: "text", value: "nothing here" },
    ]);
  });
});
