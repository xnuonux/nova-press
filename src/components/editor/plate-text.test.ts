import { describe, expect, it } from "vitest";

import { coercePlateValue, deriveExcerpt, plateText } from "./plate-text";

describe("plateText", () => {
  it("returns an empty string for a blank document", () => {
    expect(plateText([{ type: "p", children: [{ text: "" }] }])).toBe("");
  });

  it("joins the leaves inside a block", () => {
    expect(plateText([{ type: "p", children: [{ text: "the " }, { text: "muse" }] }])).toBe(
      "the muse",
    );
  });

  it("separates blocks with a newline", () => {
    expect(
      plateText([
        { type: "h1", children: [{ text: "title" }] },
        { type: "p", children: [{ text: "body text" }] },
      ]),
    ).toBe("title\nbody text");
  });

  // body is untyped jsonb on read, so nodeText must be total over garbage
  // ... a malformed node must never throw (it would 500 the editor route).
  it("survives a node with no children and no text", () => {
    expect(plateText([{ type: "p" }] as unknown as never)).toBe("");
  });

  it("survives an empty object node", () => {
    expect(plateText([{}] as unknown as never)).toBe("");
  });

  it("survives a malformed leaf inside a valid block", () => {
    expect(plateText([{ type: "p", children: [{ text: "ok " }, {}] }] as unknown as never)).toBe(
      "ok ",
    );
  });

  it("survives null and primitive nodes without throwing or emitting text", () => {
    // totality is the point ... it must not throw. empty nodes still join
    // with newlines, which collapse away in the excerpt / word count.
    expect(plateText([null, "raw", 7] as unknown as never).trim()).toBe("");
  });

  it("returns an empty string for a non-array value", () => {
    expect(plateText("nope" as unknown as never)).toBe("");
  });
});

describe("coercePlateValue", () => {
  const EMPTY = [{ type: "p", children: [{ text: "" }] }];

  it("passes a valid non-empty document through unchanged", () => {
    const doc = [{ type: "p", children: [{ text: "hi" }] }];
    expect(coercePlateValue(doc)).toBe(doc);
  });

  it("falls back to an empty doc for an empty array", () => {
    expect(coercePlateValue([])).toEqual(EMPTY);
  });

  it("falls back to an empty doc for a non-array", () => {
    expect(coercePlateValue(null)).toEqual(EMPTY);
    expect(coercePlateValue({ type: "p" })).toEqual(EMPTY);
  });

  it("falls back to an empty doc when any top-level node lacks a children array", () => {
    expect(coercePlateValue([{ type: "p" }])).toEqual(EMPTY);
    expect(coercePlateValue([{}])).toEqual(EMPTY);
    expect(coercePlateValue([{ type: "p", children: [{ text: "ok" }] }, { type: "p" }])).toEqual(
      EMPTY,
    );
  });
});

describe("deriveExcerpt", () => {
  it("returns short text unchanged", () => {
    expect(deriveExcerpt([{ type: "p", children: [{ text: "a short line" }] }])).toBe(
      "a short line",
    );
  });

  it("returns an empty string for a blank document", () => {
    expect(deriveExcerpt([{ type: "p", children: [{ text: "" }] }])).toBe("");
  });

  it("collapses the block newlines and runs of whitespace into single spaces", () => {
    expect(
      deriveExcerpt([
        { type: "h1", children: [{ text: "the title" }] },
        { type: "p", children: [{ text: "body   with   gaps" }] },
      ]),
    ).toBe("the title body with gaps");
  });

  it("truncates past the max and appends an ellipsis", () => {
    const long = "word ".repeat(60).trim(); // ~299 chars
    const out = deriveExcerpt([{ type: "p", children: [{ text: long }] }], 40);
    expect(out.endsWith("...")).toBe(true);
    // body (without the trailing "...") never exceeds the max
    expect(out.length).toBeLessThanOrEqual(43);
  });

  it("does not split an astral char at the truncation boundary", () => {
    // a high surrogate would land at index 159 and its low surrogate at 160,
    // so a naive slice(0, 160) leaves a lone surrogate (renders as U+FFFD).
    const text = "a".repeat(159) + "\u{1F600}" + "tail";
    const out = deriveExcerpt([{ type: "p", children: [{ text }] }]);
    // no unpaired surrogate survives into the excerpt
    expect(/[\uD800-\uDFFF]/.test(out.replace(/\.\.\.$/, ""))).toBe(false);
  });
});
