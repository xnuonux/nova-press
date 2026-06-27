import { describe, expect, it } from "vitest";

import type { BlockText } from "./core";
import { scansionLens } from "./scansion";

function verse(lines: string[]): BlockText[] {
  return lines.map((text, index) => ({ index, type: "verse_line", text, node: null }));
}

describe("scansionLens", () => {
  it("notes a line that runs well past the poem's established measure", () => {
    // three 6-beat lines establish the measure; the fourth runs ~12.
    const findings = scansionLens({
      blocks: verse([
        "the cat sat on the mat", // 6
        "a dog ran by the dog", // 6
        "the sun was in the sky", // 6
        "the elephant tramples slowly over the bridge", // ~12
      ]),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("note");
    expect(findings[0]!.lens).toBe("scansion");
    expect(findings[0]!.scope.blockIndex).toBe(3);
    expect(findings[0]!.message).toContain("the poem holds around 6");
  });

  it("stays quiet on free verse (no established measure)", () => {
    expect(
      scansionLens({
        blocks: verse([
          "a short line",
          "a considerably longer line that sprawls onward and on",
          "tiny",
          "another middling length of words here now",
        ]),
      }),
    ).toEqual([]);
  });

  it("never judges a word-less line (a '...' caesura) it couldn't measure", () => {
    const findings = scansionLens({
      blocks: verse([
        "the cat sat on the mat", // 6
        "a dog ran by the dog", // 6
        "the sun was in the sky", // 6
        "...", // 0 syllables ... a pause, not a 0-beat line
      ]),
    });
    expect(findings).toEqual([]);
  });

  it("finds nothing in prose (no verse blocks)", () => {
    expect(
      scansionLens({
        blocks: [
          { index: 0, type: "p", text: "just a paragraph of prose, no verse here.", node: null },
        ],
      }),
    ).toEqual([]);
  });
});
