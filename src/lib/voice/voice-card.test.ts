import { describe, expect, it } from "vitest";

import { confidenceLabel, formalityLabel, rhythmLabel, trainedAgo } from "./voice-card";

describe("formalityLabel", () => {
  it("buckets a 0..1 score", () => {
    expect(formalityLabel(0.1)).toBe("plainspoken");
    expect(formalityLabel(0.5)).toBe("balanced");
    expect(formalityLabel(0.9)).toBe("formal");
  });
  it("normalizes a stray 0..100 score", () => {
    expect(formalityLabel(85)).toBe("formal");
    expect(formalityLabel(20)).toBe("plainspoken");
  });
  it("returns null for missing/NaN", () => {
    expect(formalityLabel(null)).toBeNull();
    expect(formalityLabel(NaN)).toBeNull();
  });
});

describe("rhythmLabel", () => {
  it("describes length", () => {
    expect(rhythmLabel(8, null)).toBe("short sentences");
    expect(rhythmLabel(15, null)).toBe("medium sentences");
    expect(rhythmLabel(26, null)).toBe("long sentences");
  });
  it("adds texture from variance", () => {
    // low variance relative to avg -> even; high -> varied.
    expect(rhythmLabel(16, 4)).toBe("medium, even sentences"); // cv = 2/16 = 0.125
    expect(rhythmLabel(16, 144)).toBe("medium, varied sentences"); // cv = 12/16 = 0.75
  });
  it("returns null for missing/zero avg", () => {
    expect(rhythmLabel(null, 4)).toBeNull();
    expect(rhythmLabel(0, 4)).toBeNull();
  });
});

describe("confidenceLabel", () => {
  it("buckets confidence", () => {
    expect(confidenceLabel(0.3)).toBe("still forming");
    expect(confidenceLabel(0.65)).toBe("taking shape");
    expect(confidenceLabel(0.95)).toBe("clear");
  });
  it("returns null for missing", () => {
    expect(confidenceLabel(null)).toBeNull();
  });
});

describe("trainedAgo", () => {
  const base = Date.parse("2026-06-20T12:00:00Z");
  it("today / yesterday / days", () => {
    expect(trainedAgo("2026-06-20T08:00:00Z", base)).toBe("trained today");
    expect(trainedAgo("2026-06-19T08:00:00Z", base)).toBe("trained yesterday");
    expect(trainedAgo("2026-06-17T08:00:00Z", base)).toBe("trained 3 days ago");
  });
  it("weeks / months", () => {
    expect(trainedAgo("2026-06-06T12:00:00Z", base)).toBe("trained 2 weeks ago");
    expect(trainedAgo("2026-04-21T12:00:00Z", base)).toBe("trained 2 months ago");
  });
  it("returns null for missing/bad iso", () => {
    expect(trainedAgo(null, base)).toBeNull();
    expect(trainedAgo("not-a-date", base)).toBeNull();
  });
});
