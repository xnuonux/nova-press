import { describe, expect, it } from "vitest";

import { BULLET_ITEM, NUMBER_ITEM, groupBodyBlocks, isListType } from "./piece-blocks";

const p = (text: string) => ({ type: "p", children: [{ text }] });
const bullet = (text: string) => ({ type: BULLET_ITEM, children: [{ text }] });
const number = (text: string) => ({ type: NUMBER_ITEM, children: [{ text }] });

describe("isListType", () => {
  it("recognizes both list-item types", () => {
    expect(isListType(BULLET_ITEM)).toBe(true);
    expect(isListType(NUMBER_ITEM)).toBe(true);
  });

  it("rejects everything else", () => {
    for (const t of ["p", "h1", "blockquote", "hr", undefined, null, 7]) {
      expect(isListType(t)).toBe(false);
    }
  });
});

describe("groupBodyBlocks", () => {
  it("degrades a non-array to no groups", () => {
    expect(groupBodyBlocks(null)).toEqual([]);
    expect(groupBodyBlocks(undefined)).toEqual([]);
    expect(groupBodyBlocks("nope")).toEqual([]);
  });

  it("passes plain blocks through in order", () => {
    const groups = groupBodyBlocks([p("one"), { type: "h1", children: [{ text: "two" }] }]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ kind: "block", index: 0 });
    expect(groups[1]).toMatchObject({ kind: "block", index: 1 });
  });

  it("collapses a run of bullets into one unordered list", () => {
    const groups = groupBodyBlocks([bullet("a"), bullet("b"), bullet("c")]);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g?.kind).toBe("list");
    if (g?.kind === "list") {
      expect(g.ordered).toBe(false);
      expect(g.items.map((it) => it.index)).toEqual([0, 1, 2]);
    }
  });

  it("collapses a run of numbers into one ordered list", () => {
    const groups = groupBodyBlocks([number("a"), number("b")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: "list", ordered: true });
  });

  it("does not merge bulleted and numbered runs that touch", () => {
    const groups = groupBodyBlocks([bullet("a"), number("b")]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ kind: "list", ordered: false });
    expect(groups[1]).toMatchObject({ kind: "list", ordered: true });
  });

  it("splits one list into two when a paragraph interrupts it", () => {
    const groups = groupBodyBlocks([bullet("a"), p("break"), bullet("b")]);
    expect(groups.map((g) => g.kind)).toEqual(["list", "block", "list"]);
    expect(groups[0]).toMatchObject({ kind: "list" });
    expect(groups[2]).toMatchObject({ kind: "list" });
  });

  it("preserves original indices through a mixed document", () => {
    const groups = groupBodyBlocks([p("lead"), bullet("a"), bullet("b"), p("after"), number("1")]);
    expect(groups).toHaveLength(4);
    expect(groups[0]).toMatchObject({ kind: "block", index: 0 });
    const list = groups[1];
    if (list?.kind === "list") expect(list.items.map((it) => it.index)).toEqual([1, 2]);
    expect(groups[2]).toMatchObject({ kind: "block", index: 3 });
    expect(groups[3]).toMatchObject({ kind: "list", ordered: true });
  });

  it("tolerates malformed entries without throwing", () => {
    const groups = groupBodyBlocks([null, undefined, { type: BULLET_ITEM }]);
    expect(groups).toHaveLength(3);
    expect(groups[2]).toMatchObject({ kind: "list", ordered: false });
  });
});
