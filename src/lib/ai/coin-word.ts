// pure prompt + parse for the constrained word coiner. the model PROPOSES a
// romanized word for a meaning, within the phonology's rails; the deterministic
// isLegalWord gate validates it server-side and the deterministic coiner is the
// fallback, so a coined word ALWAYS obeys the language. xray-shaped: no db / server
// imports, unit-tested headless.

import type { Phonology } from "@/lib/conlang/phonology";

export const COIN_WORD_SYSTEM = [
  "you are a conlanger's word-smith. you coin ONE new word for a constructed language, obeying its sound system exactly.",
  "you are given the language's consonants, its vowels, and its legal syllable shapes (templates over C = a consonant and V = a vowel). build the word ONLY from those sounds, in ONLY those syllable shapes. never use a sound or a shape that isn't listed.",
  "the meaning (if given) is what the word should mean ... let it shape the word's feel, but the sound rules come first.",
  "output ONLY the word, lowercase, romanized in the given sounds. no gloss, no quotes, no punctuation, no explanation. just the one word.",
].join("\n\n");

/** the user message: the phonology rails + the meaning to coin for (bounded). */
export function buildCoinWordPrompt(phon: Phonology, meaning: string): string {
  const m = String(meaning ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return [
    `consonants (C): ${phon.consonants.join(" ")}`,
    `vowels (V): ${phon.vowels.join(" ")}`,
    `legal syllable shapes: ${phon.syllables.join(", ")}`,
    m ? `the word should mean: ${m}` : "coin any word that fits the language.",
    "coin one word.",
  ].join("\n");
}

/**
 * pull a single candidate word out of the model's reply: the first run of letters
 * (the inventory is letter-spellings, so an apostrophe / hyphen can be part of a
 * phoneme), lowercased + bounded. "" on no letters. the caller validates the
 * candidate against the phonology, so a preamble-grabbed non-word just fails the
 * gate and falls back to the deterministic coiner.
 */
export function parseCoinWord(text: string): string {
  const m = String(text ?? "")
    .toLowerCase()
    .match(/[a-z'’-]+/);
  return m ? m[0].slice(0, 60) : "";
}
