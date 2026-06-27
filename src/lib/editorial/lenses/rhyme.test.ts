import { describe, expect, it } from "vitest";

import type { BlockText } from "./core";
import { rhymeLens } from "./rhyme";

function verse(lines: string[]): BlockText[] {
  return lines.map((text, index) => ({ index, type: "verse_line", text, node: null }));
}

describe("rhymeLens", () => {
  it("flags the couplet that breaks an established couplet scheme", () => {
    // four couplets: three chime on substantive keys, the last breaks. the poem
    // must clear the MIN_CHIMING_PAIRS floor before a break is called.
    const findings = rhymeLens({
      blocks: verse([
        "i wandered lonely through the night", // ight
        "and saw the stars in pure delight", // ight  (chimes)
        "the hound was lost but soon was found", // ound
        "it bounded home across the ground", // ound  (chimes)
        "the water here is cold and deep", // eep
        "and on its bank i fell asleep", // eep   (chimes)
        "the morning broke with golden light", // ight
        "the morning sky was full of birds", // irds  (breaks)
      ]),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.lens).toBe("rhyme");
    expect(findings[0]!.severity).toBe("flag");
    expect(findings[0]!.scope.blockIndex).toBe(7);
    expect(findings[0]!.message).toContain("don't chime");
  });

  it("does not fabricate a couplet scheme from coincidental suffix rhymes", () => {
    // free verse whose lines happen to end in common suffixes (-ly, -en, -ing):
    // the coarse rhyme key must NOT call this a couplet poem and flag the odd pair.
    expect(
      rhymeLens({
        blocks: verse([
          "she moved through the house quietly", // ly
          "the floorboards answered slowly", // ly
          "a light was on in the garden", // en
          "the door had swollen, gone wooden", // en
          "the kettle was beginning", // ing
          "the morning kept on coming", // ing
          "and she stood there alone", // one
          "watching the day break away", // ay  (the "odd" pair)
        ]),
      }),
    ).toEqual([]);
  });

  it("stays quiet when the poem isn't built on couplets", () => {
    expect(
      rhymeLens({
        blocks: verse([
          "the river runs to nowhere now",
          "a heron lifts above the reeds",
          "the evening folds its quiet hands",
          "and somewhere far a kettle sings",
        ]),
      }),
    ).toEqual([]);
  });

  it("finds nothing in prose", () => {
    expect(
      rhymeLens({ blocks: [{ index: 0, type: "p", text: "a line of prose.", node: null }] }),
    ).toEqual([]);
  });
});
