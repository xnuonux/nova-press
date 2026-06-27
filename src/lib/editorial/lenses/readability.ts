// the readability lens ... NOT a generic grade. it reads each block against the
// writer's OWN sentence-length baseline (voice_profiles) and notes a sentence
// that runs well past their usual rhythm. a terse writer's 30-word sentence is
// worth a glance; a maximalist's is not. no baseline -> it stays quiet. pure.

import { sentenceWordCounts } from "@/lib/ai/voice-stats";
import type { Finding } from "@/types/editorial";

import { finding, type LensInput } from "./core";

const LENS = "readability";
// a sentence ~80% longer than the writer's norm, with an absolute floor so a
// genuinely short sentence is never flagged just because the norm is shorter.
const LONG_FACTOR = 1.8;
const LONG_FLOOR = 24;

export function readabilityLens(input: LensInput): Finding[] {
  const base = input.voiceBaseline?.sentence_length_avg;
  if (base == null || base <= 0) return [];
  const threshold = Math.max(base * LONG_FACTOR, LONG_FLOOR);

  const out: Finding[] = [];
  for (const block of input.blocks) {
    const counts = sentenceWordCounts(block.text);
    const longest = counts.length > 0 ? Math.max(...counts) : 0;
    if (longest > threshold) {
      out.push(
        finding(
          LENS,
          `a long sentence here runs ${longest} words ... well past your usual ${Math.round(base)}.`,
          "note",
          { blockIndex: block.index },
        ),
      );
    }
  }
  return out;
}
