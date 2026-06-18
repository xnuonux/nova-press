import "server-only";

import { generateText } from "ai";

import { reportError } from "@/lib/observability/report-error";

import {
  EMPTY_DISTILL,
  parseDistillation,
  VOICE_EXTRACT_SYSTEM,
  type DistilledVoice,
} from "./voice-distill";
import { getPartnerModel, resolveProviderConfig } from "./provider";
import { extractVoiceStats, type VoiceStats } from "./voice-stats";

export interface ExtractedVoice extends DistilledVoice {
  stats: VoiceStats;
  model: string;
  samples_count: number;
}

const EXTRACT_MAX_TOKENS = 800;
const SAMPLE_CAP = 6;
const SAMPLE_CHARS = 4000;

// distill a writer's OWN pieces into their voice signature: deterministic stats
// (voice-stats) + the model's qualitative read (voice-distill), merged. the
// model call degrades to stats-only on any failure ... a "train my voice" click
// must never 500 on a flaky provider, and a missing key throws synchronously
// only via getPartnerModel inside the try.
export async function extractVoiceProfile(samples: string[]): Promise<ExtractedVoice> {
  const clean = samples
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, SAMPLE_CAP);
  const stats = extractVoiceStats(clean);
  const cfg = resolveProviderConfig();

  if (clean.length === 0) {
    return { ...EMPTY_DISTILL, stats, model: cfg.modelId, samples_count: 0 };
  }

  try {
    const model = getPartnerModel();
    const prompt = clean
      .map((s, i) => `--- sample ${i + 1} ---\n${s.slice(0, SAMPLE_CHARS)}`)
      .join("\n\n");
    const { text } = await generateText({
      model,
      system: VOICE_EXTRACT_SYSTEM,
      prompt,
      temperature: 0.2,
      maxTokens: EXTRACT_MAX_TOKENS,
    });
    const distilled = parseDistillation(text);
    return { ...distilled, stats, model: cfg.modelId, samples_count: clean.length };
  } catch (err) {
    reportError(err, { tag: "voice-extract-distill-failed" });
    return { ...EMPTY_DISTILL, stats, model: cfg.modelId, samples_count: clean.length };
  }
}
