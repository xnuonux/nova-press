import "server-only";

import { streamText } from "ai";

import { reportError } from "@/lib/observability/report-error";

import { buildPartnerPrompt } from "./prompts/system-prompt";
import { COMMAND_CONFIG, getPartnerModel } from "./provider";

// a standalone sentence-ender (. ! ?) that isn't part of our "..." pause ...
// the lookarounds skip the three dots we swap dashes into.
const SENTENCE_END = /(?<![.])[.!?](?![.])/;

// streams a single-sentence continuation for inline ghost text. it reuses the
// "continue" command config (the voice-mirror prompt, a tight token cap) but
// streams token by token so the suggestion appears as it's written, the way the
// x article ghostwriter feels. dashes are swapped to "..." per chunk, and the
// stream self-terminates at the first real sentence boundary so the whisper is
// exactly one finished sentence, terminal mark and all. all streamText lives in
// lib/ai, never in routes or components.
export function streamGhost(context: string): ReadableStream<Uint8Array> {
  const model = getPartnerModel();
  const cfg = COMMAND_CONFIG.continue;
  const { system, prompt } = buildPartnerPrompt({ command: "continue", context });

  const result = streamText({
    model,
    system,
    prompt,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
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
          // cut at the earliest of a hard newline (exclusive ... a whisper never
          // crosses a paragraph) or a real sentence boundary (inclusive of the
          // mark, so the suggestion reads as finished).
          const nl = acc.indexOf("\n");
          const m = SENTENCE_END.exec(acc);
          const sentEnd = m ? m.index + 1 : -1;
          let cut = -1;
          if (nl >= 0 && m) cut = m.index < nl ? sentEnd : nl;
          else if (nl >= 0) cut = nl;
          else if (sentEnd >= 0) cut = sentEnd;

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
