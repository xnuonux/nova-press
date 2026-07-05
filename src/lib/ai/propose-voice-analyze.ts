import "server-only";

import { generateText } from "ai";

import { reportError } from "@/lib/observability/report-error";
import { normalizeVoiceDelta, type VoiceDelta } from "@/lib/voices/delta";

import { getPartnerModel } from "./provider";
import { buildVoiceProposePrompt, parseVoiceProposal, VOICE_PROPOSE_SYSTEM } from "./propose-voice";

const PROPOSE_MAX_TOKENS = 220;

// propose a character-voice overlay from the writer's description, read into a
// NORMALIZED VoiceDelta the panel pre-fills its form with. degrades to a MINIMAL
// delta (the name + the description as its summary) on ANY failure (missing key,
// flaky provider, parse) ... the "let nova draft it" affordance always at least
// pre-fills the steer, so a degraded proposal just leaves the writer to refine it.
// returns null only when there's no name to hang a voice on.
export async function proposeVoice(name: string, description: string): Promise<VoiceDelta | null> {
  const cleanName = String(name ?? "").trim();
  if (!cleanName) return null;

  const fallback = (): VoiceDelta | null => {
    const r = normalizeVoiceDelta({ name: cleanName, summary: description });
    return r.ok && r.delta ? r.delta : null;
  };

  try {
    const model = getPartnerModel();
    const { text } = await generateText({
      model,
      system: VOICE_PROPOSE_SYSTEM,
      prompt: buildVoiceProposePrompt(cleanName, description),
      temperature: 0.4,
      maxTokens: PROPOSE_MAX_TOKENS,
    });
    const draft = parseVoiceProposal(text);
    // the writer's name always wins over anything the model echoed.
    const r = normalizeVoiceDelta({ ...draft, name: cleanName });
    if (r.ok && r.delta) return r.delta;
    return fallback();
  } catch (err) {
    reportError(err, { tag: "propose-voice-failed" });
    return fallback();
  }
}
