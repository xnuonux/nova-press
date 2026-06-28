import "server-only";

import { generateText } from "ai";

import { reportError } from "@/lib/observability/report-error";

import {
  CODEX_PROPOSE_SYSTEM,
  buildProposePrompt,
  parseProposal,
  type EntityProposal,
} from "./codex-propose";
import { getPartnerModel } from "./provider";

const PROPOSE_MAX_TOKENS = 160;

// propose a codex entry's kind + one-line summary for a recurring name, read from
// the work's prose. degrades to {} on ANY failure (missing key, flaky provider,
// parse) ... the "add to codex" affordance must always at least pre-fill the name,
// so a degraded proposal just leaves the writer to pick the kind + write the line.
export async function proposeEntity(mention: string, prose: string): Promise<EntityProposal> {
  if (!mention.trim()) return {};
  try {
    const model = getPartnerModel();
    const { text } = await generateText({
      model,
      system: CODEX_PROPOSE_SYSTEM,
      prompt: buildProposePrompt(mention, prose),
      temperature: 0.2,
      maxTokens: PROPOSE_MAX_TOKENS,
    });
    return parseProposal(text);
  } catch (err) {
    reportError(err, { tag: "codex-propose-failed" });
    return {};
  }
}
