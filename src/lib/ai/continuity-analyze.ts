import "server-only";

import { generateText } from "ai";

import type { ContinuityFinding } from "@/lib/continuity/types";
import { reportError } from "@/lib/observability/report-error";

import { CONTINUITY_SYSTEM, buildContinuityPrompt, parseContinuity } from "./continuity-model";
import { getPartnerModel } from "./provider";

const MAX_PIECES = 40;
const ANALYZE_MAX_TOKENS = 900;

export interface ContinuityModelResult {
  findings: ContinuityFinding[];
  // true when the model call itself failed (missing key, flaky provider) ... lets
  // the scan record a partial result instead of conflating a real failure with a
  // genuinely consistent work.
  failed: boolean;
}

// read a work's prose against its bible facts and return contradiction / timeline
// findings. degrades to [] on ANY failure (missing key, parse) ... the model
// layer must never break a scan; the deterministic pass still stands. the bible
// is handed in already composed (the same readBibleForWork string the author
// reads). returns [] without a model rather than inventing concerns.
export async function analyzeContinuity(
  pieces: readonly { pieceId: string; text: string }[],
  bible: string,
): Promise<ContinuityModelResult> {
  const trimmed = pieces.slice(0, MAX_PIECES);
  const hasProse = trimmed.some((p) => String(p.text ?? "").trim().length > 0);
  // nothing to read, or no bible to read against ... the model has no ground to
  // judge a contradiction from, so stay silent (not failed, just empty).
  if (!hasProse || !bible.trim()) {
    return { findings: [], failed: false };
  }

  try {
    const model = getPartnerModel();
    const { text } = await generateText({
      model,
      system: CONTINUITY_SYSTEM,
      prompt: buildContinuityPrompt(trimmed, bible),
      temperature: 0.2,
      maxTokens: ANALYZE_MAX_TOKENS,
    });
    return {
      findings: parseContinuity(
        text,
        trimmed.map((p) => p.pieceId),
      ),
      failed: false,
    };
  } catch (err) {
    reportError(err, { tag: "continuity-analyze-failed" });
    return { findings: [], failed: true };
  }
}
