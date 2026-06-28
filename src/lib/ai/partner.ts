import "server-only";

import { generateText, streamText } from "ai";

import { reportError } from "@/lib/observability/report-error";

import { sentenceCut } from "./ghost-format";
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
  // recent turns of the conversation (rail only) ... flows straight into
  // buildPartnerPrompt so a streamed "respond" remembers the last few lines.
  history?: { role: "writer" | "nova"; text: string }[];
  // the draft the writer is working on (rail only) ... so nova spars over the
  // actual piece, not a line in a vacuum.
  document?: string;
  // the relevant world bible (retrieval-by-mention) ... folded into the prompt's
  // reserved slot so a riposte stays in-world. flows straight into
  // buildPartnerPrompt; empty for a standalone piece or an empty codex.
  bible?: string;
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

// streaming variant of a partner command ... powers the conversation rail. it
// returns a utf-8 byte stream of the reply as it generates, the way the ghost
// whisper feels. dashes are swapped to "..." per chunk; a one-sentence command
// (respond / continue) self-terminates at the first real sentence boundary so
// the reply is exactly one finished sentence, terminal mark and all, and the
// "..."-aware cut never trips on a pause. the client runs the full voice-keeper
// at stream end for the lowercase / preamble pass + the drift flag.
// getPartnerModel() throws synchronously on a missing key, so the route still
// answers a clean 502 before any bytes go out.
export function streamPartnerCommand(input: PartnerInput): ReadableStream<Uint8Array> {
  const cfg = COMMAND_CONFIG[input.command];
  const model = getPartnerModel();
  const { system, prompt } = buildPartnerPrompt(input);

  const result = streamText({
    model,
    system,
    prompt,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    // the body streams after a 200 is already on the wire, so a mid-stream
    // provider failure can't reach the route's try/catch ... log it here.
    onError: ({ error }) =>
      reportError(error, { tag: "ai-partner-stream", command: input.command }),
  });

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let acc = ""; // all cleaned text seen so far
      let sent = 0; // chars already enqueued from acc
      try {
        for await (const chunk of result.textStream) {
          acc += chunk.replace(/\s*[—–]\s*/g, " ... ");
          if (cfg.oneSentence) {
            const cut = sentenceCut(acc);
            if (cut >= 0) {
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
        // ran to the token cap with no boundary ... flush whatever's left.
        if (acc.length > sent) controller.enqueue(encoder.encode(acc.slice(sent)));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
