// the voice-drift lens ... the whole-piece counterpart to readability. it
// computes the piece's own sentence-length stats (the same extractVoiceStats
// the writer's voice was distilled with) and notes when the piece as a whole
// drifts from the writer's resolved baseline ... not one long sentence, but a
// stretch that simply does not sound like them. no baseline / too little text
// -> it stays quiet. pure.

import { extractVoiceStats, sentenceWordCounts } from "@/lib/ai/voice-stats";
import type { Finding } from "@/types/editorial";

import { finding, blocksToText, type LensInput } from "./core";

const LENS = "voice-drift";
// the piece's average sentence length must diverge from the writer's norm by
// more than this fraction, over a piece long enough for the average to mean
// something, before nova says a word.
const DRIFT_RATIO = 0.4;
const MIN_SENTENCES = 5;

export function voiceDriftLens(input: LensInput): Finding[] {
  const base = input.voiceBaseline?.sentence_length_avg;
  if (base == null || base <= 0) return [];

  const text = blocksToText(input.blocks);
  if (sentenceWordCounts(text).length < MIN_SENTENCES) return [];

  const pieceAvg = extractVoiceStats([text]).sentence_length_avg;
  if (pieceAvg == null || pieceAvg <= 0) return [];

  const ratio = Math.abs(pieceAvg - base) / base;
  if (ratio <= DRIFT_RATIO) return [];

  const direction = pieceAvg > base ? "longer" : "shorter";
  return [
    finding(
      LENS,
      `these sentences run ${direction} than your usual voice ... about ${Math.round(pieceAvg)} words against your ${Math.round(base)}.`,
      "note",
      {},
    ),
  ];
}
