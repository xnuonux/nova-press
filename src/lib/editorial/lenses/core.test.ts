import { describe, it, expect } from "vitest";

import { deriveBlocks, blocksToText, finding } from "./core";

describe("deriveBlocks flattens a plate value into per-block text", () => {
  it("indexes each block with its type + plain text + raw node", () => {
    const blocks = deriveBlocks([
      { type: "h1", children: [{ text: "title" }] },
      { type: "p", children: [{ text: "a " }, { text: "line", bold: true }] },
    ] as never);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ index: 0, type: "h1", text: "title" });
    expect(blocks[1]).toMatchObject({ index: 1, type: "p", text: "a line" });
    expect(blocks[1]!.node).toBeTypeOf("object");
  });

  it("flattens inline links into the block text", () => {
    const blocks = deriveBlocks([
      {
        type: "p",
        children: [{ text: "see " }, { type: "a", url: "https://x", children: [{ text: "here" }] }],
      },
    ] as never);
    expect(blocks[0]!.text).toBe("see here");
  });

  it("defaults a typeless node to a paragraph and degrades non-arrays to []", () => {
    expect(deriveBlocks([{ children: [{ text: "x" }] }] as never)[0]!.type).toBe("p");
    expect(deriveBlocks(null as never)).toEqual([]);
  });
});

describe("blocksToText + finding", () => {
  it("joins blocks by blank lines (paragraph breaks for the voice stats)", () => {
    const blocks = deriveBlocks([
      { type: "p", children: [{ text: "one" }] },
      { type: "p", children: [{ text: "two" }] },
    ] as never);
    expect(blocksToText(blocks)).toBe("one\n\ntwo");
  });

  it("builds a finding in the canonical shape, status open", () => {
    expect(finding("mechanical", "a note", "note", { blockIndex: 3 })).toEqual({
      lens: "mechanical",
      message: "a note",
      severity: "note",
      scope: { blockIndex: 3 },
      status: "open",
    });
  });
});
