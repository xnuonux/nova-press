// the scansion lens ... reads a poem against its OWN measure, never a textbook
// meter. it establishes the poem's dominant syllable count (establishedMeter ...
// null for free verse, where there's no measure to break) and notes a line that
// runs well past it. a deliberately gentle mirror: the syllable heuristic is
// approximate, so this observes a drift ("this line runs longer"), never grades
// the foot. self-gating ... no verse blocks, no findings. pure + unit-tested.

import type { Finding } from "@/types/editorial";

import { establishedMeter, groupVerse, poemLines, type VerseBlock } from "../poetry";
import { finding, type LensInput } from "./core";

const LENS = "scansion";
// how many syllables off the established measure before nova says a word. an
// absolute floor (not a ratio) so a tight tetrameter and a loose pentameter are
// both judged against their own count, not a percentage.
const DRIFT = 2;

export function scansionLens(input: LensInput): Finding[] {
  const poems = groupVerse(input.blocks as VerseBlock[]);
  if (poems.length === 0) return [];

  const out: Finding[] = [];
  for (const poem of poems) {
    const lines = poemLines(poem);
    const meter = establishedMeter(lines);
    if (meter == null) continue; // free verse ... no measure to drift from
    for (const line of lines) {
      // a word-less line (a "..." caesura, an asterism, numerals) reads as 0
      // syllables ... establishedMeter already excludes those, so skip them here
      // too rather than mirror a nonsensical "runs 0 beats".
      if (line.syllables <= 0) continue;
      if (Math.abs(line.syllables - meter) > DRIFT) {
        const beats = line.syllables === 1 ? "beat" : "beats";
        out.push(
          finding(
            LENS,
            `this line runs ${line.syllables} ${beats} ... the poem holds around ${meter}.`,
            "note",
            { blockIndex: line.index },
          ),
        );
      }
    }
  }
  return out;
}
