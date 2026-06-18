import "server-only";

import { generateText } from "ai";

import { reportError } from "@/lib/observability/report-error";

import { getPartnerModel } from "./provider";
import { EMPTY_XRAY, XRAY_SYSTEM, buildXrayPrompt, parseXray, type XrayStructure } from "./xray";

const MAX_BLOCKS = 120;
const ANALYZE_MAX_TOKENS = 900;

// read a draft's blocks and return its argument structure. degrades to an empty
// structure on ANY failure (missing key, flaky provider, unparseable reply) ...
// an x-ray request must never 500 the editor, it just comes back with no spine.
export async function analyzeStructure(blocks: string[]): Promise<XrayStructure> {
  const trimmed = blocks.slice(0, MAX_BLOCKS);
  if (!trimmed.some((b) => String(b ?? "").trim().length > 0)) return EMPTY_XRAY;

  try {
    const model = getPartnerModel();
    const { text } = await generateText({
      model,
      system: XRAY_SYSTEM,
      prompt: buildXrayPrompt(trimmed),
      temperature: 0.2,
      maxTokens: ANALYZE_MAX_TOKENS,
    });
    return parseXray(text, trimmed.length);
  } catch (err) {
    reportError(err, { tag: "xray-analyze-failed" });
    return EMPTY_XRAY;
  }
}
