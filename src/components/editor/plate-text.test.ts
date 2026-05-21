import { describe, expect, it } from "vitest";

import { plateText } from "./plate-text";

describe("plateText", () => {
  it("returns an empty string for a blank document", () => {
    expect(plateText([{ type: "p", children: [{ text: "" }] }])).toBe("");
  });

  it("joins the leaves inside a block", () => {
    expect(
      plateText([
        { type: "p", children: [{ text: "the " }, { text: "muse" }] },
      ]),
    ).toBe("the muse");
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
