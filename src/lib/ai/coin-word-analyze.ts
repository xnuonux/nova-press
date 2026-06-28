import "server-only";

import { generateText } from "ai";

import { coinLegalWord } from "@/lib/conlang/coiner";
import { isLegalWord, type Phonology } from "@/lib/conlang/phonology";
import { reportError } from "@/lib/observability/report-error";

import { COIN_WORD_SYSTEM, buildCoinWordPrompt, parseCoinWord } from "./coin-word";
import { getPartnerModel } from "./provider";

const COIN_MAX_TOKENS = 24;

export interface CoinedWord {
  word: string;
  fromModel: boolean;
}

// coin a word for a meaning, within the phonology's rails. the DETERMINISTIC gate
// (isLegalWord) validates the model's proposal: an illegal proposal, a parse
// failure, or a missing model all degrade to the deterministic coiner (legal by
// construction). NEVER throws + ALWAYS returns a legal word, so the coiner can't
// be the reason a word breaks the language.
export async function coinWord(phon: Phonology, meaning: string): Promise<CoinedWord> {
  try {
    const model = getPartnerModel();
    const { text } = await generateText({
      model,
      system: COIN_WORD_SYSTEM,
      prompt: buildCoinWordPrompt(phon, meaning),
      temperature: 0.9,
      maxTokens: COIN_MAX_TOKENS,
    });
    const candidate = parseCoinWord(text);
    if (candidate && isLegalWord(phon, candidate)) {
      return { word: candidate, fromModel: true };
    }
  } catch (err) {
    reportError(err, { tag: "coin-word-failed" });
  }
  return { word: coinLegalWord(phon, Math.random), fromModel: false };
}
