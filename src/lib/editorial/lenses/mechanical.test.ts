import { describe, it, expect } from "vitest";

import { deriveBlocks, type LensInput } from "./core";
import { mechanicalLens } from "./mechanical";

function run(value: unknown): ReturnType<typeof mechanicalLens> {
  const input: LensInput = { blocks: deriveBlocks(value as never) };
  return mechanicalLens(input);
}

describe("the mechanical lens catches the small exact slips", () => {
  it("flags a double space, scoped to its block", () => {
    const out = run([{ type: "p", children: [{ text: "hello  world" }] }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      lens: "mechanical",
      severity: "note",
      scope: { blockIndex: 0 },
    });
    expect(out[0]!.message).toContain("double spaces");
  });

  it("flags a straight double quote the curler missed", () => {
    const out = run([{ type: "p", children: [{ text: 'he said "hi"' }] }]);
    expect(out).toHaveLength(1);
    expect(out[0]!.message).toContain("straight quote");
  });

  it("flags a heading that skips a level (h1 -> h3)", () => {
    const out = run([
      { type: "h1", children: [{ text: "a" }] },
      { type: "h3", children: [{ text: "b" }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ scope: { blockIndex: 1 } });
    expect(out[0]!.message).toContain("jumps from h1 to h3");
  });

  it("does not flag h1 -> h2 -> h3 (no skip)", () => {
    const out = run([
      { type: "h1", children: [{ text: "a" }] },
      { type: "h2", children: [{ text: "b" }] },
      { type: "h3", children: [{ text: "c" }] },
    ]);
    expect(out).toEqual([]);
  });

  it("flags a link with an empty / unsafe url as a flag, not a note", () => {
    const empty = run([
      {
        type: "p",
        children: [{ text: "see " }, { type: "a", url: "", children: [{ text: "here" }] }],
      },
    ]);
    expect(empty).toHaveLength(1);
    expect(empty[0]).toMatchObject({ severity: "flag", scope: { blockIndex: 0 } });

    const unsafe = run([
      { type: "p", children: [{ type: "a", url: "javascript:evil()", children: [{ text: "x" }] }] },
    ]);
    expect(unsafe[0]!.message).toContain("points nowhere");

    const safe = run([
      { type: "p", children: [{ type: "a", url: "https://ok.com", children: [{ text: "x" }] }] },
    ]);
    expect(safe).toEqual([]);
  });

  it("does not flag a straight quote or double space inside inline code", () => {
    const quoted = run([
      { type: "p", children: [{ text: "run " }, { text: 'print("x")', code: true }] },
    ]);
    expect(quoted).toEqual([]);
    const spaced = run([{ type: "p", children: [{ text: "a  b", code: true }] }]);
    expect(spaced).toEqual([]);
  });

  it("a clean piece produces nothing", () => {
    expect(run([{ type: "p", children: [{ text: "a clean line of prose." }] }])).toEqual([]);
  });
});
