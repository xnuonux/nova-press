import "server-only";

import { streamText } from "ai";

import { reportError } from "@/lib/observability/report-error";

import { sentenceCut } from "./ghost-format";
import { buildPartnerPrompt } from "./prompts/system-prompt";
import { getPartnerModel } from "./provider";

// the "continue" command caps at 48 tokens, which is enough for the partner
// rail but clips a genuinely long sentence mid-flight ... and a clipped ghost
// flushes without its terminal mark, breaking the "one finished sentence"
// promise. ghost gets more room; the sentence-boundary cut stops it at the
// first real period anyway, so this never makes a whisper longer, it just lets
// the sentence finish.
const GHOST_MAX_TOKENS = 72;
const GHOST_TEMPERATURE = 0.7;

// streams a single-sentence continuation for inline ghost text. it reuses the
// voice-mirror "continue" prompt but streams token by token so the suggestion
// appears as it's written, the way the x article ghostwriter feels. dashes are
// swapped to "..." per chunk, and the stream self-terminates at the first real
// sentence boundary so the whisper is exactly one finished sentence, terminal
// mark and all. all streamText lives in lib/ai, never in routes or components.
export function streamGhost(context: string, voiceCompactView?: string): ReadableStream<Uint8Array> {
  const model = getPartnerModel();
  const { system, prompt } = buildPartnerPrompt({ command: "continue", context, voiceCompactView });

  const result = streamText({
    model,
    system,
    prompt,
    temperature: GHOST_TEMPERATURE,
    maxTokens: GHOST_MAX_TOKENS,
    // the body is produced lazily after a 200 is sent, so a mid-stream provider
    // failure can't reach the route's try/catch. log it here ... the editor
    // stays quiet by design, but we don't lose the telemetry.
    onError: ({ error }) => reportError(error, { tag: "ai-ghost-stream" }),
  });

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let acc = ""; // all cleaned text seen so far
      let sent = 0; // chars already enqueued from acc
      try {
        for await (const chunk of result.textStream) {
          acc += chunk.replace(/\s*[—–]\s*/g, " ... ");
          const cut = sentenceCut(acc);
          if (cut >= 0) {
            const tail = acc.slice(sent, cut);
            if (tail) controller.enqueue(encoder.encode(tail));
            controller.close();
            return;
          }
          if (acc.length > sent) {
            controller.enqueue(encoder.encode(acc.slice(sent)));
            sent = acc.length;
          }
        }
        // ran to the token cap with no boundary ... flush whatever's left.
        if (acc.length > sent) controller.enqueue(encoder.encode(acc.slice(sent)));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
