/**
 * voice stats ... the deterministic half of voice extraction.
 *
 * pure (no server / ai / db imports), so it's fully unit-tested and the
 * extraction job (lib/ai/voice-extract) just hands it the writer's plain-text
 * samples. it computes the numeric voice_profiles columns the llm shouldn't
 * guess at: sentence + paragraph length (avg + variance), a punctuation
 * fingerprint, and an emoji rate. the llm handles the qualitative columns.
 */

export interface VoiceStats {
  sentence_length_avg: number | null;
  sentence_length_variance: number | null;
  paragraph_length_avg: number | null;
  paragraph_length_variance: number | null;
  // marks per 1000 words ... a shape, not raw counts, so it's comparable across
  // writers regardless of how much they've written.
  punctuation_style: Record<string, number>;
  emoji_signature: { count: number; per_1000_words: number };
}

// a standalone sentence-ender, skipping nova's "..." pause (same lookarounds as
// the ghost cutter) so an ellipsis doesn't inflate the sentence count.
const SENTENCE_SPLIT = /(?<![.])[.!?](?![.])/g;
const WORD_RE = /\p{L}[\p{L}\p{N}'']*/gu;
// a broad emoji range (pictographs + symbols + dingbats), enough for a rate.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;

function countWords(text: string): number {
  return (text.match(WORD_RE) ?? []).length;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function extractVoiceStats(samples: string[]): VoiceStats {
  const joined = samples.map((s) => s.trim()).filter(Boolean).join("\n\n");
  const totalWords = countWords(joined);

  // sentences: split on real enders, keep ones with actual words.
  const sentenceWordCounts = joined
    .split(SENTENCE_SPLIT)
    .map((s) => countWords(s))
    .filter((n) => n > 0);

  // paragraphs: blank-line separated blocks with words in them.
  const paragraphWordCounts = joined
    .split(/\n{2,}/)
    .map((p) => countWords(p))
    .filter((n) => n > 0);

  const per1000 = (count: number) => (totalWords > 0 ? round2((count / totalWords) * 1000) : 0);
  const countOf = (re: RegExp) => (joined.match(re) ?? []).length;

  const punctuation_style: Record<string, number> = {
    comma: per1000(countOf(/,/g)),
    semicolon: per1000(countOf(/;/g)),
    colon: per1000(countOf(/:/g)),
    ellipsis: per1000(countOf(/\.\.\./g)),
    question: per1000(countOf(/\?/g)),
    exclamation: per1000(countOf(/!/g)),
    parenthesis: per1000(countOf(/\(/g)),
  };

  const emojiCount = countOf(EMOJI_RE);

  return {
    sentence_length_avg: sentenceWordCounts.length ? round2(mean(sentenceWordCounts)) : null,
    sentence_length_variance: sentenceWordCounts.length ? round2(variance(sentenceWordCounts)) : null,
    paragraph_length_avg: paragraphWordCounts.length ? round2(mean(paragraphWordCounts)) : null,
    paragraph_length_variance: paragraphWordCounts.length
      ? round2(variance(paragraphWordCounts))
      : null,
    punctuation_style,
    emoji_signature: { count: emojiCount, per_1000_words: per1000(emojiCount) },
  };
}
