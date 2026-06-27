// the lens registry ... which lenses run at which editorial stage, and the
// runner that turns a resolved input into the stage's findings. adding a lens is
// one entry here. deterministic lenses run anywhere for free; the one model lens
// (structure) degrades to [] when no x-ray was injected, so the runner is safe
// to call without a model. pure.

import type { EditorialStage, Finding } from "@/types/editorial";

import type { Lens, LensInput } from "./core";
import { mechanicalLens } from "./mechanical";
import { readabilityLens } from "./readability";
import { structureLens } from "./structure";
import { voiceDriftLens } from "./voice-drift";

export type LensKind = "deterministic" | "model";

export interface LensDescriptor {
  key: string;
  lens: Lens;
  kind: LensKind;
  /** the stages this lens runs at (the craft ladder, src/lib/editorial/stages). */
  stages: readonly EditorialStage[];
}

// the order here is the order findings surface in the pass panel: structure
// first (the shape), then voice, then the fine mechanics last.
export const LENS_REGISTRY: readonly LensDescriptor[] = [
  { key: "structure", lens: structureLens, kind: "model", stages: ["developmental"] },
  {
    key: "voice-drift",
    lens: voiceDriftLens,
    kind: "deterministic",
    stages: ["developmental", "line", "copy"],
  },
  { key: "readability", lens: readabilityLens, kind: "deterministic", stages: ["line", "copy"] },
  {
    key: "mechanical",
    lens: mechanicalLens,
    kind: "deterministic",
    stages: ["line", "copy", "proof"],
  },
] as const;

/** the descriptor for a lens key, or undefined. */
export function getLens(key: string): LensDescriptor | undefined {
  return LENS_REGISTRY.find((d) => d.key === key);
}

/** the lenses that run at a stage, in registry order. */
export function lensesForStage(stage: EditorialStage): LensDescriptor[] {
  return LENS_REGISTRY.filter((d) => d.stages.includes(stage));
}

/** run a chosen set of lenses over one input + concat their findings, tagged by
 *  the lens that produced each. a lens that throws is skipped (one bad lens must
 *  never sink the whole pass), so the runner is total. */
export function runLenses(descriptors: readonly LensDescriptor[], input: LensInput): Finding[] {
  const out: Finding[] = [];
  for (const d of descriptors) {
    try {
      out.push(...d.lens(input));
    } catch {
      // a lens that blows up contributes nothing; the rest of the pass stands.
    }
  }
  return out;
}

/** run every lens registered for a stage over the input (the pass for a stage). */
export function runStage(stage: EditorialStage, input: LensInput): Finding[] {
  return runLenses(lensesForStage(stage), input);
}
