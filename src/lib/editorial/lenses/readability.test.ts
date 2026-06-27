import { describe, it, expect } from "vitest";

import type { VoiceStats } from "@/lib/ai/voice-stats";

import { deriveBlocks, type LensInput } from "./core";
import { readabilityLens } from "./readability";

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

function blockOf(sentence: string): LensInput["blocks"] {
  return deriveBlocks([{ type: "p", children: [{ text: sentence }] }] as never);
}

const sentence = (words: number): string => `${Array(words).fill("word").join(" ")}.`;

describe("the readability lens reads against the writer's OWN baseline", () => {
  it("flags a sentence well past a terse writer's norm (floor 24 words)", () => {
    const out = readabilityLens({ blocks: blockOf(sentence(26)), voiceBaseline: baseline(8) });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      lens: "readability",
      severity: "note",
      scope: { blockIndex: 0 },
    });
    expect(out[0]!.message).toContain("26 words");
    expect(out[0]!.message).toContain("your usual 8");
  });

  it("stays quiet on a short sentence even for a terse writer", () => {
    expect(readabilityLens({ blocks: blockOf(sentence(10)), voiceBaseline: baseline(8) })).toEqual(
      [],
    );
  });

  it("a maximalist needs a longer sentence before the note fires", () => {
    // baseline 20 -> threshold = max(20*1.8, 24) = 36; a 30-word sentence is fine.
    expect(readabilityLens({ blocks: blockOf(sentence(30)), voiceBaseline: baseline(20) })).toEqual(
      [],
    );
    expect(
      readabilityLens({ blocks: blockOf(sentence(40)), voiceBaseline: baseline(20) }),
    ).toHaveLength(1);
  });

  it("with no baseline it says nothing (never a generic grade)", () => {
    expect(readabilityLens({ blocks: blockOf(sentence(60)) })).toEqual([]);
    expect(readabilityLens({ blocks: blockOf(sentence(60)), voiceBaseline: null })).toEqual([]);
  });
});
