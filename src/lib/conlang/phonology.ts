// pure phonology + phonotactics for the conlang form ... the deterministic rails a
// coined word must obey. a phonology is a sound inventory (consonants + vowels,
// each a phoneme that MAY be multi-char, like "th" / "ng") plus the legal syllable
// templates over the two classes C (a consonant) and V (a vowel), e.g. "CV", "CVC".
// no db / server imports, so it's unit-tested headless. this is the syllabifier the
// form-constraints file foreshadowed ("the deterministic engines ... land in a
// later phase"): a candidate word is LEGAL when it segments into known phonemes AND
// those phonemes' C/V classes tile into a run of allowed syllable templates.
//
// segmentation is MAXIMAL MUNCH ... a digraph ("th") wins over its parts ("t"+"h"),
// the conventional, intuitive rule for a romanized inventory. it makes the read
// deterministic; a phoneme set with no digraphs is unaffected.

export interface Phonology {
  consonants: string[];
  vowels: string[];
  // syllable templates over 'C' (a consonant) and 'V' (a vowel), e.g. "CV", "CVC".
  syllables: string[];
}

// a calm default so a fresh conlang work can coin immediately (a-e-i-o-u over a
// small consonant set, open + closed syllables).
export const DEFAULT_PHONOLOGY: Phonology = {
  consonants: ["m", "n", "p", "t", "k", "s", "l", "r", "h", "w", "y"],
  vowels: ["a", "e", "i", "o", "u"],
  syllables: ["CV", "CVC", "V"],
};

const MAX_INVENTORY = 80; // phonemes per class
const MAX_TEMPLATES = 24;
const MAX_PHONEME_LEN = 4;
const MAX_TEMPLATE_LEN = 8;

// clean a phoneme-inventory list: lowercased, trimmed, letters only (a phoneme is
// a sound spelling, not punctuation), de-duped, bounded.
function cleanInventory(raw: unknown): string[] {
  const items = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,]+/) : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const v = String(item ?? "")
      .toLowerCase()
      .trim()
      .slice(0, MAX_PHONEME_LEN);
    if (!v || !/^[a-z'’-]+$/.test(v) || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= MAX_INVENTORY) break;
  }
  return out;
}

// clean a template list: each keeps only 'C' / 'V' (uppercased), blanks drop.
function cleanTemplates(raw: unknown): string[] {
  const items = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,]+/) : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const t = String(item ?? "")
      .toUpperCase()
      .replace(/[^CV]/g, "")
      .slice(0, MAX_TEMPLATE_LEN);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TEMPLATES) break;
  }
  return out;
}

/**
 * normalize a raw `work.settings.phonology` (or any junk) into a usable Phonology.
 * an empty / malformed field falls back to the DEFAULT so a conlang work always
 * has rails to coin within. a phoneme that lands in both classes is kept as a
 * consonant (classOf resolves the same way).
 */
export function normalizePhonology(raw: unknown): Phonology {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const consonants = cleanInventory(obj.consonants);
  const vowels = cleanInventory(obj.vowels).filter((v) => !consonants.includes(v));
  const syllables = cleanTemplates(obj.syllables);

  if (consonants.length === 0 || vowels.length === 0 || syllables.length === 0) {
    return DEFAULT_PHONOLOGY;
  }
  return { consonants, vowels, syllables };
}

// every phoneme, longest first, so maximal munch matches a digraph before its head.
function allPhonemesLongestFirst(phon: Phonology): string[] {
  return [...phon.consonants, ...phon.vowels].sort((a, b) => b.length - a.length);
}

/**
 * segment a word into known phonemes (maximal munch). null when a span matches no
 * phoneme (an illegal sound), so the caller reads null as "not in this language".
 */
export function segmentPhonemes(phon: Phonology, word: string): string[] | null {
  const w = String(word ?? "")
    .toLowerCase()
    .trim();
  if (!w) return null;
  const ordered = allPhonemesLongestFirst(phon);
  const out: string[] = [];
  let i = 0;
  while (i < w.length) {
    let matched = "";
    for (const p of ordered) {
      if (p.length > matched.length && w.startsWith(p, i)) {
        matched = p;
        break; // ordered longest-first, so the first hit is the longest
      }
    }
    if (!matched) return null;
    out.push(matched);
    i += matched.length;
  }
  return out;
}

/** the C/V class of a phoneme (consonant wins a tie). null if unknown. */
export function classOf(phon: Phonology, phoneme: string): "C" | "V" | null {
  const p = String(phoneme ?? "").toLowerCase();
  if (phon.consonants.includes(p)) return "C";
  if (phon.vowels.includes(p)) return "V";
  return null;
}

// can the C/V class string be tiled by a run of the allowed templates? a DP over
// positions ... greedy fails (templates CVC + CV over "CVCV" needs CV+CV, not the
// longer CVC first), so try every template at every reachable position.
function tiles(classStr: string, templates: readonly string[]): boolean {
  const n = classStr.length;
  if (n === 0) return false;
  const reach = new Array<boolean>(n + 1).fill(false);
  reach[0] = true;
  for (let i = 0; i < n; i += 1) {
    if (!reach[i]) continue;
    for (const t of templates) {
      const end = i + t.length;
      if (t.length > 0 && end <= n && classStr.startsWith(t, i)) {
        reach[end] = true;
      }
    }
  }
  return reach[n] === true;
}

/**
 * is `word` legal in this phonology? it must (1) segment fully into known phonemes
 * (maximal munch) and (2) have its C/V class run tile into the allowed syllable
 * templates. an empty word, an unknown sound, or an untileable shape is illegal.
 */
export function isLegalWord(phon: Phonology, word: string): boolean {
  const phonemes = segmentPhonemes(phon, word);
  if (!phonemes || phonemes.length === 0) return false;
  let cls = "";
  for (const p of phonemes) {
    const c = classOf(phon, p);
    if (!c) return false;
    cls += c;
  }
  return tiles(cls, phon.syllables);
}
