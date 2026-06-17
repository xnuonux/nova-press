import type { Command } from "../provider";

export interface PromptParts {
  command: Command;
  // the writer's text ... the thing nova continues / responds to / reshapes.
  context: string;
  // the distilled voice fingerprint. empty until the voice-corpus slice
  // trains it; the slot is always present so the structure never drifts.
  voiceCompactView?: string;
  // top-k retrieved passages in the writer's voice. empty for now.
  exemplars?: string[];
  // recent turns of the live exchange, oldest first ... lets a "respond"
  // riposte remember the last few lines instead of answering each in
  // isolation. empty for the one-shot commands (continue / improve / ...).
  history?: { role: "writer" | "nova"; text: string }[];
}

const IDENTITY =
  "you are nova, the writer's sparring partner inside their editor. you mirror their voice, you never overwrite it. you serve the craft, and you know when to shut up.";

// the non-negotiable voice rules + the forbidden-preamble list are shared with
// every other nova prompt (e.g. the repurpose engine), so they live as exports
// ... one source of truth keeps the voice from drifting between surfaces.
export const VOICE_RULES =
  "voice rules (never break): write in lowercase. no em-dashes or en-dashes, ever ... use ... for a pause. punchy, direct, a little vulnerable. sound like the writer on a good day, never like a chatbot.";

export const FORBIDDEN_PREAMBLE =
  "never start with: 'great', 'sure', 'absolutely', 'certainly', 'of course', 'here's a', 'i'd be happy to', 'i can'. no praise, no throat-clearing. just write the thing.";

const COMMAND_INSTRUCTION: Record<Command, string> = {
  continue:
    "continue the writing in exactly one sentence. pick up mid-thought, match the rhythm, then stop. output only the continuation.",
  respond:
    "respond to the writer in one sentence, as a sparring partner ... a nudge, a question, a sharper angle. output only the response.",
  improve:
    "improve the text. keep the writer's voice and structure, fix only what's weak. output only the improved version.",
  rewrite:
    "rewrite the text in the writer's voice, same meaning, better line. output only the rewrite.",
  shorten:
    "shorten the text. cut what doesn't earn its place, keep the voice. output only the shortened version.",
};

// assembles the voice-mirror prompt in the order the skill mandates:
// identity -> voice rules -> compact voice view -> forbidden preambles ->
// exemplars -> command instruction (system); the writer's context is the
// user message.
export function buildPartnerPrompt(parts: PromptParts): {
  system: string;
  prompt: string;
} {
  const compact = parts.voiceCompactView?.trim()
    ? `the writer's voice: ${parts.voiceCompactView.trim()}`
    : "the writer's voice: not yet trained ... mirror the tone and rhythm of their text below.";

  const exemplars =
    parts.exemplars && parts.exemplars.length > 0
      ? "lines in the writer's voice (echo this texture, never copy):\n" +
        parts.exemplars.map((e) => `- ${e}`).join("\n")
      : "lines in the writer's voice: none yet.";

  const system = [
    IDENTITY,
    VOICE_RULES,
    compact,
    FORBIDDEN_PREAMBLE,
    exemplars,
    COMMAND_INSTRUCTION[parts.command],
  ].join("\n\n");

  // fold the recent exchange into the user message when it's there, so a
  // "respond" riposte answers in the flow of the conversation, not just the
  // latest line. no history (the one-shot commands) keeps the raw context,
  // exactly as before ... the labels tell nova which lines are its own.
  const recent = (parts.history ?? []).filter((h) => h.text.trim().length > 0);
  const prompt = recent.length
    ? "the exchange so far ... respond to the writer's last line:\n" +
      recent.map((h) => `${h.role === "writer" ? "the writer" : "you (nova)"}: ${h.text}`).join("\n") +
      `\n\nthe writer: ${parts.context}`
    : parts.context;

  return { system, prompt };
}
