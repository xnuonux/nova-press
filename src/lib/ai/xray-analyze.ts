import "server-only";

import { generateText } from "ai";

import { reportError } from "@/lib/observability/report-error";

import { getPartnerModel } from "./provider";
import { EMPTY_XRAY, XRAY_SYSTEM, buildXrayPrompt, parseXray, type XrayStructure } from "./xray";

const MAX_BLOCKS = 120;
const ANALYZE_MAX_TOKENS = 900;

export interface XrayResult {
  structure: XrayStructure;
  // true when the model call itself failed (missing key, flaky provider,
  // unparseable reply) ... lets the ui say "couldn't read it" instead of
  // conflating a real failure with a genuinely structureless draft.
  failed: boolean;
}

// read a draft's blocks and return its argument structure. degrades to an empty
// structure on ANY failure ... an x-ray request must never 500 the editor. the
// `failed` flag carries the difference between "nothing to show" and "broke".
export async function analyzeStructure(blocks: string[]): Promise<XrayResult> {
  const trimmed = blocks.slice(0, MAX_BLOCKS);
  if (!trimmed.some((b) => String(b ?? "").trim().length > 0)) {
    return { structure: EMPTY_XRAY, failed: false };
  }

  try {
    const model = getPartnerModel();
    const { text } = await generateText({
      model,
      system: XRAY_SYSTEM,
      prompt: buildXrayPrompt(trimmed),
      temperature: 0.2,
      maxTokens: ANALYZE_MAX_TOKENS,
    });
    return { structure: parseXray(text, trimmed.length), failed: false };
  } catch (err) {
    reportError(err, { tag: "xray-analyze-failed" });
    return { structure: EMPTY_XRAY, failed: true };
  }
}
