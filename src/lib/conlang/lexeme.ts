// pure lexeme record shape for the conlang lexicon. a lexeme is a word-record: the
// headword (the coined word), its part of speech, and a gloss (what it means), plus
// an optional ipa pronunciation. it maps to / from the np_nodes.record jsonb the
// form registry's LEXEME_SCHEMA defines (headword, partOfSpeech, senses, ipa). no
// db / server imports, unit-tested headless; the lexicon db layer runs a draft
// through normalizeLexeme before a write.

export const PARTS_OF_SPEECH = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "particle",
  "affix",
  "pronoun",
  "other",
] as const;
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

export function isPartOfSpeech(s: unknown): s is PartOfSpeech {
  return typeof s === "string" && (PARTS_OF_SPEECH as readonly string[]).includes(s);
}

/** a lexeme as the editor sees it ... the flattened, validated view. */
export interface LexemeView {
  headword: string;
  partOfSpeech: PartOfSpeech;
  gloss: string;
  ipa: string;
}

/** the loose shape the UI / action hands in. */
export interface LexemeDraft {
  headword?: unknown;
  partOfSpeech?: unknown;
  gloss?: unknown;
  ipa?: unknown;
}

const MAX_HEADWORD = 60;
const MAX_GLOSS = 240;
const MAX_IPA = 80;

function clean(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

export interface LexemeResult {
  ok: boolean;
  lexeme?: LexemeView;
  error?: string;
}

/**
 * validate + normalize a draft into a writable lexeme, or a calm lowercase reason.
 * the headword is the only hard requirement (a word with no spelling is nothing);
 * the part of speech defaults to "other", the gloss + ipa are optional + bounded.
 */
export function normalizeLexeme(draft: LexemeDraft): LexemeResult {
  const headword = clean(draft.headword, MAX_HEADWORD);
  if (!headword) return { ok: false, error: "a lexeme needs a headword." };
  return {
    ok: true,
    lexeme: {
      headword,
      partOfSpeech: isPartOfSpeech(draft.partOfSpeech) ? draft.partOfSpeech : "other",
      gloss: clean(draft.gloss, MAX_GLOSS),
      ipa: clean(draft.ipa, MAX_IPA),
    },
  };
}

/** the np_nodes.record jsonb a lexeme is stored as (the LEXEME_SCHEMA shape). the
 *  gloss rides `senses` (the schema's meaning list); the headword indexes the row
 *  via np_nodes_headword_idx. */
export function lexemeToRecord(lex: LexemeView): Record<string, unknown> {
  return {
    headword: lex.headword,
    partOfSpeech: lex.partOfSpeech,
    senses: lex.gloss ? [lex.gloss] : [],
    ipa: lex.ipa,
  };
}

/** read a stored record back into the flattened view (tolerant of partial rows). */
export function recordToLexeme(record: Record<string, unknown> | null | undefined): LexemeView {
  const rec = record ?? {};
  const senses = Array.isArray(rec.senses) ? rec.senses : [];
  const firstSense = senses.length > 0 ? String(senses[0] ?? "") : "";
  const gloss = clean(firstSense || rec.gloss, MAX_GLOSS);
  return {
    headword: clean(rec.headword, MAX_HEADWORD),
    partOfSpeech: isPartOfSpeech(rec.partOfSpeech) ? rec.partOfSpeech : "other",
    gloss,
    ipa: clean(rec.ipa, MAX_IPA),
  };
}
