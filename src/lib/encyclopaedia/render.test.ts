import { describe, expect, it } from "vitest";

import { segmentArticle } from "./render";

describe("segmentArticle", () => {
  it("weaves xref + cite + text in reading order", () => {
    const { segments, footnotes } = segmentArticle(
      "the [[gate]] is old((Smith)) and feared((Jones)).",
    );
    expect(segments).toEqual([
      { kind: "text", value: "the " },
      { kind: "xref", target: "gate", label: "gate" },
      { kind: "text", value: " is old" },
      { kind: "cite", number: 1, text: "Smith" },
      { kind: "text", value: " and feared" },
      { kind: "cite", number: 2, text: "Jones" },
      { kind: "text", value: "." },
    ]);
    expect(footnotes).toEqual([
      { number: 1, text: "Smith" },
      { number: 2, text: "Jones" },
    ]);
  });

  it("numbers a repeated citation globally to one footnote", () => {
    const { segments, footnotes } = segmentArticle("a((src)) b((src)) c((other))");
    const nums = segments
      .filter((s) => s.kind === "cite")
      .map((s) => (s as { number: number }).number);
    expect(nums).toEqual([1, 1, 2]);
    expect(footnotes).toHaveLength(2);
  });

  it("returns one text segment for plain prose", () => {
    expect(segmentArticle("just prose").segments).toEqual([{ kind: "text", value: "just prose" }]);
  });

  it("unescapes a literal bracket", () => {
    expect(segmentArticle("a \\[[lit]] one").segments).toEqual([
      { kind: "text", value: "a [[lit]] one" },
    ]);
  });

  it("drops a citation swallowed by an xref ... no orphan footnote, no number gap", () => {
    // the ((only)) cite sits INSIDE the [[xref]] target, so it can't be shown
    // in-text. it must not get a number or a footnote; only ((outside)) survives,
    // numbered contiguously from 1.
    const { segments, footnotes } = segmentArticle("[[x ((only)) y]] ((outside))");
    const cites = segments.filter((s) => s.kind === "cite") as { number: number; text: string }[];
    expect(cites).toEqual([{ kind: "cite", number: 1, text: "outside" }]);
    expect(footnotes).toEqual([{ number: 1, text: "outside" }]);
  });

  it("drops a citation that straddles an xref boundary", () => {
    // `[[a((b]]c))` parses an xref [[a((b]] then a cite that straddles it; the
    // straddling cite is masked out, leaving no footnote behind.
    const { segments, footnotes } = segmentArticle("[[a((b]]c))");
    expect(segments.some((s) => s.kind === "cite")).toBe(false);
    expect(footnotes).toEqual([]);
  });
});
