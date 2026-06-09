import "server-only";

import { generateText } from "ai";

import {
  buildRepurposePrompt,
  REPURPOSE_FORMATS,
  type RepurposeFormat,
} from "./prompts/repurpose-prompt";
import { getPartnerModel } from "./provider";
import { voiceKeeperAudit } from "./voice-keeper";

export interface RepurposeInput {
  title: string;
  source: string;
}

export interface RepurposeVariant {
  format: RepurposeFormat;
  text: string;
  // true if the model led with a forbidden preamble (stripped by the keeper).
  drift: boolean;
}

// recompile one piece into one format. reuses the partner's provider (deepseek
// dev / anthropic prod) and runs the output through the voice-keeper, so the
// no-em-dash + lowercase invariants hold on every platform variant. all
// generateText stays in src/lib/ai per the skill boundary.
export async function runRepurpose(
  format: RepurposeFormat,
  input: RepurposeInput,
): Promise<RepurposeVariant> {
  const spec = REPURPOSE_FORMATS[format];
  const model = getPartnerModel();
  const { system, prompt } = buildRepurposePrompt({
    format,
    title: input.title,
    source: input.source,
  });

  const { text } = await generateText({
    model,
    system,
    prompt,
    temperature: spec.temperature,
    maxTokens: spec.maxTokens,
  });

  // no oneSentence cap here ... these are long-form. the keeper still kills
  // em/en-dashes, lowercases paragraph openings, and strips any preamble.
  const audited = voiceKeeperAudit(text);
  return { format, text: audited.text, drift: audited.violated };
}

// recompile into several formats at once. independent calls, so they run in
// parallel ... the slowest format sets the wall-clock, not the sum.
export async function runRepurposeSet(
  formats: RepurposeFormat[],
  input: RepurposeInput,
): Promise<RepurposeVariant[]> {
  return Promise.all(formats.map((format) => runRepurpose(format, input)));
}
