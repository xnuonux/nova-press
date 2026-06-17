import "server-only";

import { generateText } from "ai";

import { buildPartnerPrompt } from "./prompts/system-prompt";
import { COMMAND_CONFIG, getPartnerModel, type Command } from "./provider";
import { voiceKeeperAudit } from "./voice-keeper";

// one-sentence commands get a cheap early-out at the first hard newline; the
// voice-keeper's inclusive, "..."-aware cut is what actually guarantees a
// single finished sentence (terminal mark and all). the old ". "/"! "/"? "
// stops were wrong twice over ... a stop sequence is dropped from the output,
// so the sentence lost its period, and ". " also fired inside nova's "..."
// pause, clipping mid-thought. maxTokens stays the hard backstop.
const STOP_SEQUENCES = ["\n"];

export interface PartnerInput {
  command: Command;
  context: string;
  voiceCompactView?: string;
  exemplars?: string[];
}

export interface PartnerResult {
  text: string;
  // true if the completion still broke a rule after the retry ... the ui
  // surfaces this as a quiet "voice drift" signal.
  drift: boolean;
}

// the single entry point for the AI partner. builds the voice-mirror
// prompt, generates through the configured provider, enforces the one-
// sentence cap, runs the voice-keeper audit, and retries once on a
// violation before giving up. all generateText/streamText lives here, never
// in routes or components.
export async function runPartnerCommand(input: PartnerInput): Promise<PartnerResult> {
  const cfg = COMMAND_CONFIG[input.command];
  const model = getPartnerModel();

  const first = await generateOnce(model, input, cfg.temperature, cfg);
  if (!first.violated) return { text: first.text, drift: false };

  // retry once, cooler + with a sharper nudge, then accept whatever the
  // audit leaves (cleaned) and flag drift if it still broke a rule.
  const second = await generateOnce(
    model,
    { ...input, context: stricter(input.context) },
    Math.max(0.2, cfg.temperature - 0.3),
    cfg,
  );
  return { text: second.text, drift: second.violated };
}

async function generateOnce(
  model: ReturnType<typeof getPartnerModel>,
  input: PartnerInput,
  temperature: number,
  cfg: (typeof COMMAND_CONFIG)[Command],
): Promise<{ text: string; violated: boolean }> {
  const { system, prompt } = buildPartnerPrompt(input);
  const { text } = await generateText({
    model,
    system,
    prompt,
    temperature,
    maxTokens: cfg.maxTokens,
    ...(cfg.oneSentence ? { stopSequences: STOP_SEQUENCES } : {}),
  });
  const audited = voiceKeeperAudit(text, { oneSentence: cfg.oneSentence });
  return { text: audited.text, violated: audited.violated };
}

function stricter(context: string): string {
  return `${context}\n\n(reminder: lowercase, no preamble, no praise${""}, one sentence if continuing.)`;
}
