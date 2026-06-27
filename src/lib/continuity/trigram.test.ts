import { describe, expect, it } from "vitest";

import { similarity, trigrams } from "./trigram";

describe("trigrams", () => {
  it("pads pg_trgm style and windows length-3", () => {
    expect([...trigrams("word")]).toEqual(["  w", " wo", "wor", "ord", "rd "]);
  });

  it("is empty for a blank word", () => {
    expect(trigrams("").size).toBe(0);
    expect(trigrams("   ").size).toBe(0);
  });
});

describe("similarity", () => {
  it("is 1 for an exact match", () => {
    expect(similarity("marik", "marik")).toBe(1);
  });

  it("rates a one-letter slip as close (above the drift threshold)", () => {
    // "marrik" vs "marik" ... a doubled r. pg_trgm-style jaccard ~0.625.
    expect(similarity("marrik", "marik")).toBeGreaterThanOrEqual(0.6);
  });

  it("keeps a genuinely different name below the threshold", () => {
    expect(similarity("maria", "marik")).toBeLessThan(0.6);
    expect(similarity("soren", "marik")).toBeLessThan(0.3);
  });

  it("is 0 when either side is blank", () => {
    expect(similarity("", "marik")).toBe(0);
    expect(similarity("marik", "")).toBe(0);
  });
});
