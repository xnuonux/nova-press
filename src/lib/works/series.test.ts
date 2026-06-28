import { describe, expect, it } from "vitest";

import { descendantIds, parentCandidateIds, wouldCycle, type SeriesNode } from "./series";

// a series: saga (root) -> book1, book2; book1 -> book1a. plus a standalone.
const nodes: SeriesNode[] = [
  { id: "saga", parentWorkId: null },
  { id: "book1", parentWorkId: "saga" },
  { id: "book2", parentWorkId: "saga" },
  { id: "book1a", parentWorkId: "book1" },
  { id: "standalone", parentWorkId: null },
];

describe("descendantIds", () => {
  it("collects the whole subtree, excluding the root", () => {
    expect([...descendantIds(nodes, "saga")].sort()).toEqual(["book1", "book1a", "book2"]);
  });

  it("is empty for a leaf", () => {
    expect(descendantIds(nodes, "book1a").size).toBe(0);
  });

  it("terminates on a malformed pre-existing cycle", () => {
    const looped: SeriesNode[] = [
      { id: "a", parentWorkId: "b" },
      { id: "b", parentWorkId: "a" },
    ];
    // must not hang; returns the reachable set.
    expect([...descendantIds(looped, "a")].sort()).toEqual(["a", "b"]);
  });
});

describe("wouldCycle", () => {
  it("forbids attaching a work under itself", () => {
    expect(wouldCycle(nodes, "saga", "saga")).toBe(true);
  });

  it("forbids attaching a work under its own descendant", () => {
    expect(wouldCycle(nodes, "saga", "book1a")).toBe(true);
  });

  it("allows attaching under an unrelated work", () => {
    expect(wouldCycle(nodes, "standalone", "saga")).toBe(false);
  });

  it("never cycles on a detach (null parent)", () => {
    expect(wouldCycle(nodes, "book1", null)).toBe(false);
  });
});

describe("parentCandidateIds", () => {
  it("excludes the work itself and its descendants", () => {
    expect(parentCandidateIds(nodes, "saga").sort()).toEqual(["standalone"]);
  });

  it("offers everything else to a standalone work", () => {
    expect(parentCandidateIds(nodes, "standalone").sort()).toEqual([
      "book1",
      "book1a",
      "book2",
      "saga",
    ]);
  });
});
