import "server-only";

import { streamText } from "ai";

import { reportError } from "@/lib/observability/report-error";

import { lineCut, paragraphCut } from "./ghost-format";
import { buildAuthorPrompt } from "./prompts/author-prompt";
import { AUTHOR_CONFIG, getPartnerModel, type AuthorTask } from "./provider";

export interface AuthorInput {
  task: AuthorTask;
  title: string;
  context: string;
  document?: string;
  voiceCompactView?: string;
  exemplars?: string[];
  // RESERVED for phase 4 (world bible). undefined for now ... the route doesn't
  // fill it yet, but the seam is here so phase 4 is a one-line change.
  bible?: string;
}

// stream a beat (or an outline) the author writes IN the writer's voice. mirrors
// the ghost/repurpose stream seam: token by token, em/en-dashes swapped to "..."
// per chunk so a dash never reaches the wire (the HARD voice invariant), and a
// beat task self-terminates at the first paragraph break so the author writes
// exactly one beat and never bleeds into the next. the client runs the full
// voice-keeper at stream end for the lowercase / preamble pass + the drift flag.
// all streamText lives in src/lib/ai per the voice-mirror skill boundary.
// getPartnerModel() throws synchronously on a missing key, so the route still
// answers a clean 502 before any bytes go out.
export function streamAuthor(input: AuthorInput): ReadableStream<Uint8Array> {
  const cfg = AUTHOR_CONFIG[input.task];
  const model = getPartnerModel();
  const { system, prompt } = buildAuthorPrompt({
    task: input.task,
    title: input.title,
    context: input.context,
    document: input.document,
    voiceCompactView: input.voiceCompactView,
    exemplars: input.exemplars,
    bible: input.bible,
  });

  const result = streamText({
    model,
    system,
    prompt,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    // the body streams after a 200 is already on the wire, so a mid-stream
    // provider failure can't reach the route's try/catch ... log it here, same
    // as the ghost + repurpose paths.
    onError: ({ error }) => reportError(error, { tag: "ai-author-stream", task: input.task }),
  });

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let acc = ""; // all cleaned text seen so far
      let sent = 0; // chars already enqueued from acc
      try {
        for await (const chunk of result.textStream) {
          acc += chunk.replace(/\s*[—–]\s*/g, " ... ");
          if (cfg.stop !== "none") {
            const cut = cfg.stop === "line" ? lineCut(acc) : paragraphCut(acc);
            // ignore a break the model emits BEFORE any real content (a stray
            // leading blank line / newline) ... cutting there closes on an empty
            // beat. only the first break that FOLLOWS real text ends the stream.
            if (cut > 0 && acc.slice(0, cut).trim().length > 0) {
              const tail = acc.slice(sent, cut);
              if (tail) controller.enqueue(encoder.encode(tail));
              controller.close();
              return;
            }
          }
          if (acc.length > sent) {
            controller.enqueue(encoder.encode(acc.slice(sent)));
            sent = acc.length;
          }
        }
        // ran to the token cap with no paragraph break ... flush what's left.
        if (acc.length > sent) controller.enqueue(encoder.encode(acc.slice(sent)));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
