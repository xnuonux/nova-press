import { describe, it, expect } from "vitest";

import type { XrayStructure } from "@/lib/ai/xray";

import { structureLens } from "./structure";

const xray = (threads: XrayStructure["threads"]): XrayStructure => ({ roles: [], threads });

describe("the structure lens turns the x-ray's threads into descriptive notes", () => {
  it("one note per thread, anchored at its start, carrying the derived label", () => {
    const out = structureLens({
      blocks: [],
      xray: xray([
        { from: 0, to: 7, label: "opening ... payoff" },
        { from: 2, to: 5, label: "thesis ... evidence" },
      ]),
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ lens: "structure", severity: "note", scope: { blockIndex: 0 } });
    expect(out[0]!.message).toContain("opening ... payoff");
    expect(out[1]).toMatchObject({ scope: { blockIndex: 2 } });
  });

  it("no x-ray (or no threads) -> nothing (the model lens degrades to [])", () => {
    expect(structureLens({ blocks: [] })).toEqual([]);
    expect(structureLens({ blocks: [], xray: null })).toEqual([]);
    expect(structureLens({ blocks: [], xray: xray([]) })).toEqual([]);
  });
});
