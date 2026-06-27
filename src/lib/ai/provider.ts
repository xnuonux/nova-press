/**
 * nova AI partner ... provider abstraction.
 *
 * dev runs on deepseek (openai-compatible api), prod on anthropic. flip
 * AI_PROVIDER to swap ... nothing downstream changes. every AI call in nova
 * goes through getPartnerModel() per the voice-mirror skill boundary; no
 * direct provider construction in routes or components.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

export type Provider = "deepseek" | "anthropic";

export interface ProviderConfig {
  provider: Provider;
  modelId: string;
  baseURL?: string;
  apiKey: string | undefined;
  apiKeyEnvVar: "DEEPSEEK_API_KEY" | "ANTHROPIC_API_KEY";
}

// pure: which provider + model + key, given the environment. split out so
// selection is testable without constructing a real client.
export function resolveProviderConfig(
  env: Record<string, string | undefined> = process.env,
): ProviderConfig {
  const provider: Provider = env.AI_PROVIDER === "anthropic" ? "anthropic" : "deepseek";

  if (provider === "anthropic") {
    return {
      provider,
      modelId: env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      apiKey: env.ANTHROPIC_API_KEY,
      apiKeyEnvVar: "ANTHROPIC_API_KEY",
    };
  }
  return {
    provider,
    modelId: env.DEEPSEEK_MODEL || "deepseek-chat",
    baseURL: "https://api.deepseek.com",
    apiKey: env.DEEPSEEK_API_KEY,
    apiKeyEnvVar: "DEEPSEEK_API_KEY",
  };
}

// the live model for the configured provider. throws a clear error if the
// selected provider's key is missing.
export function getPartnerModel(
  env: Record<string, string | undefined> = process.env,
): LanguageModelV1 {
  const cfg = resolveProviderConfig(env);
  if (!cfg.apiKey) {
    throw new Error(`missing ${cfg.apiKeyEnvVar} ... the ai partner can't run without it`);
  }
  if (cfg.provider === "anthropic") {
    return createAnthropic({ apiKey: cfg.apiKey })(cfg.modelId);
  }
  // deepseek speaks the openai api, so the openai provider + a baseURL
  // override is the cleanest v4-compatible path.
  return createOpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL })(cfg.modelId);
}

export type Command = "continue" | "respond" | "improve" | "rewrite" | "shorten";

export interface CommandConfig {
  temperature: number;
  maxTokens: number;
  oneSentence: boolean;
}

// per-command generation settings. one-sentence commands get a tight token
// cap + stop sequences at the endpoint; the open ones allow more room.
export const COMMAND_CONFIG: Record<Command, CommandConfig> = {
  continue: { temperature: 0.7, maxTokens: 48, oneSentence: true },
  respond: { temperature: 0.7, maxTokens: 90, oneSentence: true },
  improve: { temperature: 0.5, maxTokens: 260, oneSentence: false },
  rewrite: { temperature: 0.6, maxTokens: 260, oneSentence: false },
  shorten: { temperature: 0.4, maxTokens: 180, oneSentence: false },
};

export function isCommand(value: unknown): value is Command {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(COMMAND_CONFIG, value);
}

// the ai AUTHOR ... the generative counterpart to the partner/ghost. where the
// partner spars and the ghost whispers a line, the author writes a whole beat IN
// the writer's voice: expand a note into prose, draft the beat described at the
// caret, or scaffold the piece into an outline. it never runs past what was
// asked ... a beat is one paragraph, an outline is a skeleton, never a chapter.
export type AuthorTask = "expand" | "draft-beat" | "outline";

export interface AuthorConfig {
  temperature: number;
  maxTokens: number;
  // a beat is one paragraph: the stream stops at the first paragraph break so
  // the author never bleeds into a second beat. false for the outline, which is
  // a multi-line skeleton by design.
  oneBeat: boolean;
}

// per-task generation settings. the beat tasks get a paragraph's worth of room
// and stop at the paragraph break; the outline gets more room for a short list
// of beats but is still a skeleton, never drafted prose.
export const AUTHOR_CONFIG: Record<AuthorTask, AuthorConfig> = {
  expand: { temperature: 0.7, maxTokens: 220, oneBeat: true },
  "draft-beat": { temperature: 0.7, maxTokens: 240, oneBeat: true },
  outline: { temperature: 0.6, maxTokens: 380, oneBeat: false },
};

export function isAuthorTask(value: unknown): value is AuthorTask {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(AUTHOR_CONFIG, value);
}
