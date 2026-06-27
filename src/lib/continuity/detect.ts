// the deterministic continuity pass ... cheap, exact, no model, unit-testable
// like the editorial lenses. given a piece's prose + the work's bible names, it
// catches two things a string pass CAN do:
//   - NAME-DRIFT: a proper noun close (trigram) to a known bible name but not
//     exactly it ... "marrik" where the bible says "marik".
//   - UNINTRODUCED: a proper noun that recurs but matches no known name and
//     drifts toward none ... a character the writer may want to add to the bible.
// both are descriptive MIRRORS ("looks like a slip for", "isn't in the bible
// yet"), never verdicts. the model layer (continuity-model) catches the harder
// reads a string pass can't (a contradicted fact, a timeline slip).
//
// the precision guard is the MID-SENTENCE requirement: a proper noun must appear
// at least once NOT at a sentence start, which filters the every-sentence-start
// capital that would otherwise drown the signal in false positives.

import type { ContinuityFinding, KnownName, ScanPiece } from "./types";
import { similarity } from "./trigram";

// a mention this close to a known name reads as a slip (pg_trgm-style jaccard).
const DRIFT_THRESHOLD = 0.6;
// an unknown proper noun must recur this often before nova suggests adding it.
const MIN_RECUR = 3;
// ignore "i", "a", and other short capitals.
const MIN_LEN = 3;

// common words that get capitalized at a sentence start but aren't proper nouns.
// the mid-sentence requirement does most of the filtering; this catches the
// stragglers that happen to appear mid-sentence (e.g. a capitalized "I"), plus
// the calendar names a writer would never put in a bible (a recurring "Monday" /
// "April" mid-sentence would otherwise read as an unintroduced character).
const STOPWORDS = new Set([
  "the",
  "and",
  "but",
  "for",
  "nor",
  "yet",
  "she",
  "her",
  "his",
  "him",
  "its",
  "they",
  "them",
  "their",
  "this",
  "that",
  "these",
  "those",
  "there",
  "then",
  "when",
  "where",
  "while",
  "what",
  "who",
  "which",
  "with",
  "from",
  "into",
  "not",
  "now",
  "once",
  "one",
  "two",
  "all",
  "any",
  "some",
  "such",
  "than",
  "you",
  "your",
  "yours",
  "ours",
  "mine",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

// leading words stripped when reducing a name/alias to its anchor token ("the
// ferryman" -> "ferryman", "the marik" -> "marik"). NOT "old" ... that's part of
// the name "old marik".
const LEADING_ARTICLES = new Set(["the", "a", "an"]);

interface Mention {
  lower: string;
  display: string;
  count: number;
  midSentence: boolean;
}

interface KnownIndex {
  // every full name + alias, lowercased, so a real mention is never flagged.
  exact: Set<string>;
  // single-token anchor names -> entity id, the drift targets.
  tokens: Map<string, string>;
}

function indexKnown(known: readonly KnownName[]): KnownIndex {
  const exact = new Set<string>();
  const tokens = new Map<string, string>();
  for (const k of known) {
    for (const raw of [k.name, ...(k.aliases ?? [])]) {
      const name = String(raw ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      if (!name) continue;
      exact.add(name);
      const words = name.split(" ").filter((w) => !LEADING_ARTICLES.has(w));
      const sole = words[0];
      if (words.length === 1 && sole && sole.length >= MIN_LEN && !tokens.has(sole)) {
        tokens.set(sole, k.entityId);
      }
    }
  }
  return { exact, tokens };
}

// pull the proper-noun candidates from prose. a word is "sentence-initial" when
// it's the first word or the gap since the previous word holds a sentence
// terminator; a capitalized word that appears MID-sentence at least once is a
// proper-noun candidate. total over garbage (a non-string -> no mentions).
export function extractMentions(text: string): Map<string, Mention> {
  const s = String(text ?? "");
  const mentions = new Map<string, Mention>();
  const re = /[A-Za-z][A-Za-z'’-]*/g;

  const tokens: { word: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) tokens.push({ word: m[0], start: m.index, end: re.lastIndex });

  tokens.forEach((tok, i) => {
    if (!/^[A-Z]/.test(tok.word)) return;
    // drop a trailing possessive ('s / ’s) BEFORE the quote/hyphen strip, so
    // "Marik's" reads as the same mention as "marik" (and "Marrik's" still
    // trigram-drifts to "marik") instead of a false "unintroduced" on the
    // canonical name.
    const lower = tok.word
      .toLowerCase()
      .replace(/['’]s$/, "")
      .replace(/['’-]+$/, "");
    if (lower.length < MIN_LEN || STOPWORDS.has(lower)) return;

    const prev = tokens[i - 1];
    const gap = prev ? s.slice(prev.end, tok.start) : "";
    // the last non-space char before this token ... an opening quote or a colon
    // means this is a dialogue / clause opener, NOT a proper noun mid-sentence
    // (so a tag-first line like said, "Hush." doesn't read "Hush" as a name). a
    // closing curly quote ”/’ is NOT an opener, so a real name after a quoted
    // line still reads mid-sentence.
    const opener = gap.replace(/\s+$/, "").slice(-1);
    const initial =
      i === 0 ||
      (prev ? /[.!?]/.test(gap) : true) ||
      opener === ":" ||
      opener === '"' ||
      opener === "'" ||
      opener === "“" ||
      opener === "‘";
    const mid = !initial;

    const existing = mentions.get(lower);
    if (existing) {
      existing.count += 1;
      existing.midSentence = existing.midSentence || mid;
    } else {
      mentions.set(lower, { lower, display: tok.word, count: 1, midSentence: mid });
    }
  });
  return mentions;
}

/** the deterministic continuity pass for one piece. */
export function detectPiece(
  pieceId: string,
  text: string,
  known: readonly KnownName[],
): ContinuityFinding[] {
  const { exact, tokens } = indexKnown(known);
  const mentions = extractMentions(text);
  const out: ContinuityFinding[] = [];

  for (const mention of mentions.values()) {
    if (!mention.midSentence) continue; // a proper noun must read as one, not a sentence-opener
    if (exact.has(mention.lower) || tokens.has(mention.lower)) continue; // a known name

    let best = "";
    let bestSim = 0;
    for (const key of tokens.keys()) {
      const sim = similarity(mention.lower, key);
      if (sim > bestSim) {
        bestSim = sim;
        best = key;
      }
    }

    if (best && bestSim >= DRIFT_THRESHOLD) {
      out.push({
        kind: "name_drift",
        message: `"${mention.display}" looks like a slip for "${best}" ... the bible spells it that way.`,
        entityId: tokens.get(best) ?? null,
        pieceId,
        scope: {
          mention: mention.display,
          near: best,
          similarity: Math.round(bestSim * 100) / 100,
        },
      });
    } else if (mention.count >= MIN_RECUR) {
      out.push({
        kind: "unintroduced",
        message: `"${mention.display}" turns up ${mention.count} times but isn't in the bible yet.`,
        entityId: null,
        pieceId,
        scope: { mention: mention.display, count: mention.count },
      });
    }
  }
  return out;
}

/** the whole work: the deterministic pass over each piece, in order. */
export function detectWork(
  pieces: readonly ScanPiece[],
  known: readonly KnownName[],
): ContinuityFinding[] {
  return pieces.flatMap((p) => detectPiece(p.pieceId, p.text, known));
}
