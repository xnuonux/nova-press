import { describe, it, expect } from "vitest";

import type { VoiceStats } from "@/lib/ai/voice-stats";

import { deriveBlocks, type LensInput } from "./core";
import { voiceDriftLens } from "./voice-drift";

function baseline(avg: number): VoiceStats {
  return {
    sentence_length_avg: avg,
    sentence_length_variance: 4,
    paragraph_length_avg: 40,
    paragraph_length_variance: 100,
    punctuation_style: {},
    emoji_signature: { count: 0, per_1000_words: 0 },
  };
}

// n sentences of `words` words each, as one paragraph block.
function piece(n: number, words: number): LensInput["blocks"] {
  const sentence = `${Array(words).fill("word").join(" ")}.`;
  return deriveBlocks([
    { type: "p", children: [{ text: Array(n).fill(sentence).join(" ") }] },
  ] as never);
}

describe("the voice-drift lens notes when the piece sounds unlike the writer", () => {
  it("flags a long-winded piece against a terse baseline", () => {
    const out = voiceDriftLens({ blocks: piece(5, 20), voiceBaseline: baseline(8) });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ lens: "voice-drift", severity: "note", scope: {} });
    expect(out[0]!.message).toContain("longer");
    expect(out[0]!.message).toContain("your 8");
  });

  it("flags a clipped piece against a long-winded baseline (the other direction)", () => {
    const out = voiceDriftLens({ blocks: piece(6, 6), voiceBaseline: baseline(20) });
    expect(out).toHaveLength(1);
    expect(out[0]!.message).toContain("shorter");
  });

  it("stays quiet when the piece matches the baseline", () => {
    expect(voiceDriftLens({ blocks: piece(6, 8), voiceBaseline: baseline(8) })).toEqual([]);
  });

  it("stays quiet on too little text for the average to mean anything", () => {
    expect(voiceDriftLens({ blocks: piece(3, 20), voiceBaseline: baseline(8) })).toEqual([]);
  });

  it("with no baseline it says nothing", () => {
    expect(voiceDriftLens({ blocks: piece(8, 20) })).toEqual([]);
  });
});
