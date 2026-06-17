import { describe, expect, it } from "vitest";

import { slugify, slugWithSuffix } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("The Thing Nobody Says")).toBe("the-thing-nobody-says");
  });

  it("collapses punctuation and runs of separators", () => {
    expect(slugify("hello,   world!! -- yes")).toBe("hello-world-yes");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  ...wow...  ")).toBe("wow");
  });

  it("strips accents", () => {
    expect(slugify("café déjà vu")).toBe("cafe-deja-vu");
  });

  it("falls back to 'untitled' for empty or punctuation-only titles", () => {
    expect(slugify("")).toBe("untitled");
    expect(slugify("!!!")).toBe("untitled");
    expect(slugify("   ")).toBe("untitled");
  });

  it("caps length and never ends in a hyphen", () => {
    const long = `${"a".repeat(100)} ${"b".repeat(100)}`;
    const s = slugify(long);
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("slugWithSuffix", () => {
  it("appends the suffix with a single hyphen", () => {
    expect(slugWithSuffix("my-piece", "a1b2c3")).toBe("my-piece-a1b2c3");
  });

  it("stays within the length cap", () => {
    const s = slugWithSuffix("x".repeat(90), "abc123");
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-abc123")).toBe(true);
  });

  it("does not double the hyphen before the suffix", () => {
    expect(slugWithSuffix("trail-", "zz")).toBe("trail-zz");
  });
});
