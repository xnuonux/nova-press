// the editorial ladder rides on these pure functions ... the forward-gate, the
// backward-free drop, the work-stage min, and the staleness watermark. pinned.

import { describe, it, expect } from "vitest";

import {
  STAGES,
  isEditorialStage,
  stageRank,
  nextStage,
  prevStage,
  classifyTransition,
  isAllowedTransition,
  workStage,
  isPassStale,
} from "./stages";

describe("the ladder is ordered drafting -> exported", () => {
  it("ranks each stage by its position", () => {
    expect(STAGES).toEqual([
      "drafting",
      "developmental",
      "line",
      "copy",
      "proof",
      "typeset",
      "exported",
    ]);
    expect(stageRank("drafting")).toBe(0);
    expect(stageRank("exported")).toBe(6);
  });

  it("guards real stages, ranks an unknown value as the floor", () => {
    expect(isEditorialStage("line")).toBe(true);
    expect(isEditorialStage("editing")).toBe(false);
    expect(isEditorialStage(null)).toBe(false);
    expect(stageRank("nonsense" as never)).toBe(0);
  });

  it("steps up + down the ladder, null at the ends", () => {
    expect(nextStage("drafting")).toBe("developmental");
    expect(nextStage("exported")).toBeNull();
    expect(prevStage("exported")).toBe("typeset");
    expect(prevStage("drafting")).toBeNull();
  });
});

describe("transitions are forward-gated + backward-free", () => {
  it("a single step up is an advance; two or more is a forbidden skip", () => {
    expect(classifyTransition("drafting", "developmental")).toBe("advance");
    expect(classifyTransition("drafting", "line")).toBe("skip");
    expect(isAllowedTransition("drafting", "developmental")).toBe(true);
    expect(isAllowedTransition("drafting", "line")).toBe(false);
  });

  it("any drop back is a free retreat", () => {
    expect(classifyTransition("copy", "drafting")).toBe("retreat");
    expect(classifyTransition("proof", "line")).toBe("retreat");
    expect(isAllowedTransition("proof", "drafting")).toBe(true);
  });

  it("the same stage is a no-op, not a skip", () => {
    expect(classifyTransition("line", "line")).toBe("same");
    expect(isAllowedTransition("line", "line")).toBe(true);
  });
});

describe("a work is only as finished as its least-finished piece", () => {
  it("the work stage is the min over its pieces", () => {
    expect(workStage(["proof", "line", "copy"])).toBe("line");
    expect(workStage(["exported", "exported"])).toBe("exported");
    expect(workStage([])).toBe("drafting");
  });
});

describe("a pass goes stale when the writer edits past it", () => {
  it("stale iff source_edited_at < the piece's last_edited_at", () => {
    expect(isPassStale("2026-06-01T00:00:00Z", "2026-06-02T00:00:00Z")).toBe(true);
    expect(isPassStale("2026-06-02T00:00:00Z", "2026-06-02T00:00:00Z")).toBe(false);
    expect(isPassStale("2026-06-03T00:00:00Z", "2026-06-02T00:00:00Z")).toBe(false);
  });

  it("a malformed timestamp never cries wolf (reads not-stale)", () => {
    expect(isPassStale("not-a-date", "2026-06-02T00:00:00Z")).toBe(false);
    expect(isPassStale("2026-06-01T00:00:00Z", "garbage")).toBe(false);
  });
});
