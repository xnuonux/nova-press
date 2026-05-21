/**
 * nova AI partner ... anthropic SDK wrapper.
 *
 * placeholder for week 1. real wiring lands in T-015 + T-022.
 *
 * every AI call in nova MUST go through this module. no direct streamText
 * or generateText calls from route handlers or components. the voice-mirror
 * skill enforces this.
 */

import { createAnthropic } from "@ai-sdk/anthropic";

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODELS = {
  partner: "claude-sonnet-4-5",
  premium: "claude-opus-4-5",
} as const;

export type NovaModel = keyof typeof MODELS;

/**
 * placeholder. returns the model id to use for a given command.
 * real selector with temperature + token cap lands in week 2.
 */
export function selectModel(_command: string): string {
  return MODELS.partner;
}
