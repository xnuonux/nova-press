import { describe, expect, it } from "vitest";

import { deriveExcerpt, plateText } from "./plate-text";

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
});
