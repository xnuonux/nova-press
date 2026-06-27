// the structure lens ... the x-ray (src/lib/ai/xray.ts), promoted into the lens
// shape. the model reads the draft as an argument and returns its load-bearing
// threads (a promise to its payoff); the parse already defends the soul (labels
// are DERIVED from the endpoint roles, never the model's free text, so no
// verdict can smuggle in). this lens is the pure transform of that structure
// into findings ... one descriptive note per thread, anchored at its start. the
// model call lives upstream (xray-analyze); the structure is injected via input.
// no x-ray -> []. pure.

import type { Finding } from "@/types/editorial";

import { finding, type LensInput } from "./core";

const LENS = "structure";

export function structureLens(input: LensInput): Finding[] {
  const xray = input.xray;
  if (!xray || !Array.isArray(xray.threads) || xray.threads.length === 0) return [];
  return xray.threads.map((thread) =>
    finding(LENS, `a load-bearing thread ... ${thread.label}.`, "note", {
      blockIndex: thread.from,
    }),
  );
}
