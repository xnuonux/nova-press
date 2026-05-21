import { describe, expect, it } from "vitest";

import { countWords } from "./utils";

describe("countWords", () => {
  it("counts zero for an empty or whitespace string", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n  ")).toBe(0);
  });

  it("counts a single word", () => {
    expect(countWords("nova")).toBe(1);
  });

  it("counts words split by any whitespace", () => {
    expect(countWords("the muse writes back")).toBe(4);
    expect(countWords("  spaced   out \n words ")).toBe(3);
  });
});
