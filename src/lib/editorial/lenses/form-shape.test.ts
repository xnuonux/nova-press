import { describe, expect, it } from "vitest";

import type { BlockText } from "./core";
import { formShapeLens } from "./form-shape";

// build a block run from stanzas of line-counts, separated by an empty paragraph.
function poem(stanzaSizes: number[]): BlockText[] {
  const blocks: BlockText[] = [];
  let index = 0;
  stanzaSizes.forEach((size, s) => {
    if (s > 0) {
      blocks.push({ index: index++, type: "p", text: "", node: null }); // stanza break
    }
    for (let i = 0; i < size; i += 1) {
      blocks.push({ index: index++, type: "verse_line", text: `line ${s}.${i}`, node: null });
    }
  });
  return blocks;
}

describe("formShapeLens", () => {
  it("notes a stanza that drifts off an established shape mid-poem", () => {
    const findings = formShapeLens({ blocks: poem([4, 3, 4, 4]) });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.lens).toBe("form-shape");
    expect(findings[0]!.severity).toBe("note");
    expect(findings[0]!.message).toContain("3 lines");
    expect(findings[0]!.message).toContain("the others hold 4");
  });

  it("leaves a deliberate closing tag alone (a sonnet couplet, an envoi)", () => {
    // a shakespearean sonnet [4,4,4,2] ... the short final stanza defines the
    // form; nova must not flag it. (same for a ballade envoi / sestina tornada.)
    expect(formShapeLens({ blocks: poem([4, 4, 4, 2]) })).toEqual([]);
    expect(formShapeLens({ blocks: poem([8, 8, 8, 4]) })).toEqual([]);
  });

  it("still notes a final stanza that runs LONGER than the shape", () => {
    // a longer tail is a drift, not a recognized closing tag.
    const findings = formShapeLens({ blocks: poem([4, 4, 4, 6]) });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("6 lines");
  });

  it("stays quiet when there's no dominant stanza shape", () => {
    expect(formShapeLens({ blocks: poem([2, 5, 3, 4]) })).toEqual([]);
  });

  it("needs at least three stanzas to call a shape", () => {
    expect(formShapeLens({ blocks: poem([4, 3]) })).toEqual([]);
  });

  it("finds nothing in prose", () => {
    expect(
      formShapeLens({ blocks: [{ index: 0, type: "p", text: "a paragraph.", node: null }] }),
    ).toEqual([]);
  });
});
