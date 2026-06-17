import "server-only";

import { generateText, streamText } from "ai";

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

// streaming variant of one format. returns a utf-8 byte stream of the text as
// it generates. the HARD invariant (no em-dashes EVER) is enforced per chunk
// right here, so a dash never reaches the wire even mid-stream; the client
// runs the full voice-keeper at stream end for the lowercase-first + preamble
// pass + the final drift flag. streamText stays inside src/lib/ai per the
// skill boundary. getPartnerModel() throws synchronously on a missing key, so
// the route can still answer with a clean 502 before any bytes go out.
export function streamRepurpose(
  format: RepurposeFormat,
  input: RepurposeInput,
): ReadableStream<Uint8Array> {
  const spec = REPURPOSE_FORMATS[format];
  const model = getPartnerModel();
  const { system, prompt } = buildRepurposePrompt({
    format,
    title: input.title,
    source: input.source,
  });

  const result = streamText({
    model,
    system,
    prompt,
    temperature: spec.temperature,
    maxTokens: spec.maxTokens,
  });

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          // em/en-dash -> " ... " per chunk, matching voiceKeeperAudit exactly
          // so the streaming output reads the same as the non-streaming path.
          // a dash is a single code point so it never splits across a chunk
          // boundary; the surrounding-space match is per-chunk, which at worst
          // leaves a stray space at a boundary in the rare case the model
          // disobeys and emits a dash at all.
          controller.enqueue(encoder.encode(chunk.replace(/\s*[—–]\s*/g, " ... ")));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
