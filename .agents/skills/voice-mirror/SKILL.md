---
name: voice-mirror
description: Enforce nova's voice fidelity rules on the AI partner integration. Use when touching anything in src/lib/ai/, the AI panel, slash menu commands, ghost text, or any code that generates user-visible AI output. Triggers on AI partner work, prompt files, system prompts.
---

# voice-mirror

nova's wedge is that AI suggestions sound like the user wrote them, not like a chatbot. this skill enforces the rules that make that true.

## the four non-negotiables

### 1. one sentence by default

ghost text and `/continue` produce ONE sentence, never more. enforced two ways:

- server: `stopSequences: ['\n', '. ', '! ', '? ']` plus a hard `maxTokens` cap (~30)
- client: regex-truncate at the first `[.?!]\s` boundary even if the model overshoots
- exception: user explicitly invoked `/expand` or `/rewrite` with a multi-sentence selection

### 2. voice mirror, not voice impose

every AI prompt MUST inject the user's voice profile compact view before the command instruction. the order is:

1. identity block ("you are nova, the user's writing partner")
2. voice rules (lowercase, no em-dash, `...` for pauses)
3. compact voice view (from voice profile, ~120 tokens)
4. forbidden preamble list ("never start with 'great', 'sure', 'absolutely', 'here's a', 'i'd be happy to'")
5. retrieved exemplars (top-3 from corpus by cosine to current paragraph)
6. recent piece context (~600 tokens)
7. command-specific instruction

### 3. voice-keeper audit before display

every AI completion runs through a sanity pass before reaching the user:

- strip leading preamble matches via regex
- strip em-dashes, replace with `...`
- enforce lowercase on the first character of paragraphs (proper nouns + code blocks excluded)
- if the completion fails any check, retry once with a stricter system message; if it fails again, surface the raw completion in a "voice drift detected" toast

### 4. accept/reject log

every suggestion writes to `accept_reject_log` (per `docs/01-architecture.md`):

- `invocation_id`, `accepted bool`, `edit_distance_after`, `time_to_accept_ms`, `voice_match_score`
- powers retrieval boost (accepted patterns) and negative examples (rejected patterns)

## when this skill fires

- editing files in `src/lib/ai/`
- adding or modifying prompts in `src/lib/ai/prompts/`
- wiring the plate AIKit / SlashKit / CopilotKit
- building the AI panel UI in `src/components/editor/partner-rail.tsx`
- anything that calls `streamText` or `generateText` from `ai` sdk

## red flags to stop on

- a prompt without the voice rules block
- a prompt without the compact voice view injection
- AI output bypassing the voice-keeper audit
- ghost text without the one-sentence cap
- any `streamText` call outside the `src/lib/ai/` boundary

if you hit any of these, halt and surface in chat.
