import { describe, expect, it } from "vitest";

import { auditedLines, stripMarker } from "./author-format";

describe("stripMarker", () => {
  it("strips a leading bullet or number marker", () => {
    expect(stripMarker("- the hook lands")).toBe("the hook lands");
    expect(stripMarker("* the hook lands")).toBe("the hook lands");
    expect(stripMarker("• the hook lands")).toBe("the hook lands");
    expect(stripMarker("1. the hook lands")).toBe("the hook lands");
    expect(stripMarker("2) the turn")).toBe("the turn");
  });

  it("leaves an unmarked line alone (but trims it)", () => {
    expect(stripMarker("  the hook lands  ")).toBe("the hook lands");
  });
});

describe("auditedLines", () => {
  // the regression guard for the review's major finding: an outline streams as
  // single-newline-separated lines, and the voice-keeper only lowercases the
  // first char of each *paragraph* (blank-line separated), so auditing the whole
  // blob left lines 2..N title-cased. auditing PER LINE keeps every beat lowercase.
  it("lowercases EVERY outline line, not just the first", () => {
    const raw = "The hook lands\nThen the turn\nA reveal\nThe landing";
    expect(auditedLines("outline", raw)).toEqual([
      "the hook lands",
      "then the turn",
      "a reveal",
      "the landing",
    ]);
  });

  it("strips markers AND lowercases each outline line", () => {
    const raw = "- The hook\n2. Then the turn\n* A reveal";
    expect(auditedLines("outline", raw)).toEqual(["the hook", "then the turn", "a reveal"]);
  });

  it("drops empty / whitespace outline lines", () => {
    expect(auditedLines("outline", "The hook\n\n   \nThe turn")).toEqual(["the hook", "the turn"]);
  });

  it("folds a beat into one paragraph, lowercased at the open", () => {
    expect(auditedLines("expand", "The ferryman waited")).toEqual(["the ferryman waited"]);
    // an internal newline inside a beat collapses to a single space (one paragraph).
    expect(auditedLines("draft-beat", "The dock was empty\nand cold")).toEqual([
      "the dock was empty and cold",
    ]);
  });

  it("returns no lines for empty or whitespace-only input", () => {
    expect(auditedLines("expand", "")).toEqual([]);
    expect(auditedLines("expand", "   \n  ")).toEqual([]);
    expect(auditedLines("outline", "\n\n")).toEqual([]);
  });

  it("never lets an em-dash survive on any path (the hard invariant)", () => {
    expect(auditedLines("expand", "the dock — empty").join("")).not.toContain("—");
    expect(
      auditedLines("outline", "The hook — a promise\nThe turn — a cost").join(""),
    ).not.toContain("—");
  });
});
