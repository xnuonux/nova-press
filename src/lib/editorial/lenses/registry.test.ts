import { describe, it, expect } from "vitest";

import { deriveBlocks, type LensInput, type Lens } from "./core";
import { LENS_REGISTRY, getLens, lensesForStage, runLenses, runStage } from "./registry";

describe("the lens registry maps lenses to stages", () => {
  it("the four lenses are registered with their kinds", () => {
    expect(LENS_REGISTRY.map((d) => d.key)).toEqual([
      "structure",
      "voice-drift",
      "readability",
      "mechanical",
    ]);
    expect(getLens("structure")!.kind).toBe("model");
    expect(getLens("mechanical")!.kind).toBe("deterministic");
    expect(getLens("nope")).toBeUndefined();
  });

  it("lensesForStage returns the right lenses per stage", () => {
    expect(lensesForStage("drafting").map((d) => d.key)).toEqual([]);
    expect(lensesForStage("developmental").map((d) => d.key)).toEqual(["structure", "voice-drift"]);
    expect(lensesForStage("proof").map((d) => d.key)).toEqual(["mechanical"]);
    expect(lensesForStage("exported").map((d) => d.key)).toEqual([]);
  });

  it("runStage runs every lens for a stage over the input", () => {
    const input: LensInput = {
      blocks: deriveBlocks([{ type: "p", children: [{ text: "double  space" }] }] as never),
    };
    const out = runStage("proof", input); // proof -> mechanical
    expect(out).toHaveLength(1);
    expect(out[0]!.lens).toBe("mechanical");
  });

  it("runLenses is total: a throwing lens is skipped, the rest stand", () => {
    const boom: Lens = () => {
      throw new Error("kaboom");
    };
    const ok: Lens = () => [
      { lens: "ok", message: "fine", severity: "note", scope: {}, status: "open" },
    ];
    const out = runLenses(
      [
        { key: "boom", lens: boom, kind: "deterministic", stages: [] },
        { key: "ok", lens: ok, kind: "deterministic", stages: [] },
      ],
      { blocks: [] },
    );
    expect(out).toEqual([
      { lens: "ok", message: "fine", severity: "note", scope: {}, status: "open" },
    ]);
  });
});
