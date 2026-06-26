// nova press · the mythos · the structure-tree logic, pinned.
//
// the binder, reorder, and subtree-delete all ride on these pure functions, and
// the spine has no FK cascade to catch a mistake ... so they are pinned hard:
// correct nesting + order + depth, orphan surfacing, cycle-safety, fractional
// ordering, and skeleton flattening (parents before children).

import { describe, it, expect } from "vitest";
import {
  buildTree,
  midpointPosition,
  collectSubtreeIds,
  flattenSkeleton,
  rollupWordCounts,
} from "./tree";
import type { StructureNode } from "@/types/works";
import type { NodeSeed } from "@/lib/forms/types";

const node = (p: Partial<StructureNode> & { id: string }): StructureNode => ({
  userId: "u",
  workId: "w",
  parentId: null,
  nodeType: "section",
  title: "t",
  position: 0,
  isLeaf: false,
  pieceId: null,
  childWorkId: null,
  record: {},
  synopsis: null,
  canon: true,
  wordCount: 0,
  status: "active",
  nodeMetadata: {},
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...p,
});

describe("buildTree restitches a flat node list into ordered trees with depth", () => {
  const nodes = [
    node({ id: "m", parentId: null, position: 1 }),
    node({ id: "p2", parentId: "m", position: 2 }),
    node({ id: "p1", parentId: "m", position: 1 }),
    node({ id: "c1", parentId: "p1", position: 1 }),
  ];

  it("nests parents over children and orders siblings by position", () => {
    const tree = buildTree(nodes);
    expect(tree.map((t) => t.id)).toEqual(["m"]);
    expect(tree[0]!.depth).toBe(0);
    expect(tree[0]!.children.map((c) => c.id)).toEqual(["p1", "p2"]); // sorted by position, not input order
    expect(tree[0]!.children[0]!.depth).toBe(1);
    expect(tree[0]!.children[0]!.children.map((c) => c.id)).toEqual(["c1"]);
    expect(tree[0]!.children[0]!.children[0]!.depth).toBe(2);
  });

  it("surfaces an orphan (parent not in the set) as a root rather than dropping it", () => {
    const withOrphan = [
      ...nodes,
      node({ id: "ghost-child", parentId: "does-not-exist", position: 5 }),
    ];
    const tree = buildTree(withOrphan);
    expect(tree.map((t) => t.id).sort()).toEqual(["ghost-child", "m"]);
  });

  it("does not spin on a cycle (a corrupt parent loop terminates, never hangs)", () => {
    const cyclic = [node({ id: "a", parentId: "b" }), node({ id: "b", parentId: "a" })];
    expect(buildTree(cyclic)).toEqual([]); // a pure cycle has no root; it just terminates
  });
});

describe("midpointPosition gives a fractional slot, so the list never renumbers", () => {
  it("between two siblings is the midpoint", () => {
    expect(midpointPosition(2, 4)).toBe(3);
  });
  it("after the tail steps forward; before the head steps back", () => {
    expect(midpointPosition(2, null)).toBe(3);
    expect(midpointPosition(null, 4)).toBe(3);
  });
  it("into an empty list is 0", () => {
    expect(midpointPosition(null, null)).toBe(0);
  });
});

describe("collectSubtreeIds gathers a node and all its descendants", () => {
  const nodes = [
    node({ id: "m", parentId: null }),
    node({ id: "p1", parentId: "m" }),
    node({ id: "c1", parentId: "p1" }),
    node({ id: "p2", parentId: "m" }),
  ];

  it("includes the root and everything beneath it", () => {
    expect(collectSubtreeIds(nodes, "p1").sort()).toEqual(["c1", "p1"]);
    expect(collectSubtreeIds(nodes, "m").sort()).toEqual(["c1", "m", "p1", "p2"]);
  });

  it("a leaf returns just itself", () => {
    expect(collectSubtreeIds(nodes, "c1")).toEqual(["c1"]);
  });
});

describe("rollupWordCounts sums each leaf up its ancestors into a work total", () => {
  // a tiny novel: act one { chapter 1 { scene a (leaf), scene b (leaf) } },
  // act two { scene c (leaf) }.
  const nodes = [
    node({ id: "act1", parentId: null, position: 1 }),
    node({ id: "ch1", parentId: "act1", position: 1 }),
    node({ id: "sa", parentId: "ch1", position: 1, isLeaf: true }),
    node({ id: "sb", parentId: "ch1", position: 2, isLeaf: true }),
    node({ id: "act2", parentId: null, position: 2 }),
    node({ id: "sc", parentId: "act2", position: 1, isLeaf: true }),
  ];
  const leafCounts = new Map([
    ["sa", 300],
    ["sb", 200],
    ["sc", 150],
  ]);

  it("rolls leaf counts up to chapter, act, and the work total", () => {
    const { totals, workTotal } = rollupWordCounts(nodes, leafCounts);
    expect(totals.get("sa")).toBe(300);
    expect(totals.get("ch1")).toBe(500); // 300 + 200
    expect(totals.get("act1")).toBe(500);
    expect(totals.get("act2")).toBe(150);
    expect(workTotal).toBe(650); // 500 + 150
  });

  it("a leaf with no recorded count contributes zero, never NaN", () => {
    const { totals, workTotal } = rollupWordCounts(nodes, new Map([["sa", 300]]));
    expect(totals.get("ch1")).toBe(300);
    expect(workTotal).toBe(300);
  });

  it("surfaces an orphan's words instead of losing them (orphan is a root)", () => {
    const withOrphan = [...nodes, node({ id: "ghost", parentId: "missing", isLeaf: true })];
    const { workTotal } = rollupWordCounts(withOrphan, new Map([...leafCounts, ["ghost", 99]]));
    expect(workTotal).toBe(749); // 650 + 99
  });
});

describe("flattenSkeleton lays a form scaffold out parents-first for insertion", () => {
  const skeleton: NodeSeed[] = [
    {
      nodeType: "part",
      title: "act one",
      children: [
        {
          nodeType: "chapter",
          title: "chapter 1",
          children: [{ nodeType: "scene", title: "scene 1", isLeaf: true, pieceKind: "scene" }],
        },
      ],
    },
    { nodeType: "part", title: "act two" },
  ];

  it("emits every seed once, parents before children, with sibling positions", () => {
    const specs = flattenSkeleton(skeleton);
    expect(specs).toHaveLength(4);

    const actOne = specs.find((s) => s.title === "act one")!;
    const chapter = specs.find((s) => s.title === "chapter 1")!;
    const scene = specs.find((s) => s.title === "scene 1")!;
    const actTwo = specs.find((s) => s.title === "act two")!;

    // roots have no parent; the deeper seeds point at their parent's tempId
    expect(actOne.parentTempId).toBeNull();
    expect(actTwo.parentTempId).toBeNull();
    expect(chapter.parentTempId).toBe(actOne.tempId);
    expect(scene.parentTempId).toBe(chapter.tempId);

    // a parent always appears before its child in the insert order
    expect(specs.indexOf(actOne)).toBeLessThan(specs.indexOf(chapter));
    expect(specs.indexOf(chapter)).toBeLessThan(specs.indexOf(scene));

    // sibling positions + the leaf carries its content kind through
    expect(actOne.position).toBe(1);
    expect(actTwo.position).toBe(2);
    expect(scene.isLeaf).toBe(true);
    expect(scene.pieceKind).toBe("scene");
  });
});
