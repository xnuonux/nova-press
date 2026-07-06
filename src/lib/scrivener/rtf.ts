// nova press · the mythos · a pure rtf text extractor (the scrivener arm).
//
// scrivener stores each document's prose as rtf. we want the WORDS and the
// paragraph breaks ... not the formatting, not the font tables, not the
// pictures. the lift-list's rtf-parser is stale + callback-shaped (the arch
// doc itself flags it high-risk), and this is exactly the kind of small text
// machine the project builds as pure code: a control-word state machine,
// exact, unit-tested, no dependency.
//
// what it understands (enough for prose, deliberately no more):
//   {...}            groups, with group-scoped state
//   \word[-]N[ ]     control words ... \par|\line -> a break, \tab -> a space,
//                    the typographic quotes/dashes -> their glyphs, \ucN sets
//                    the unicode fallback skip, everything unknown is ignored
//   \uN              a unicode char (negative = the signed-16-bit convention),
//                    followed by uc fallback units to swallow
//   \'hh             a hex byte (read as latin-1 ... scrivener prose is
//                    effectively that after \u handling)
//   \\ \{ \}         literal escapes; \~ a no-break space; \- \_ soft hyphens
//                    (dropped ... the typesetter plants its own)
//   {\*\...} + the plumbing destinations (fonttbl, colortbl, stylesheet,
//   info, pict, ...) are skipped whole.
//
// the writer's own characters pass through as written ... an em-dash in
// IMPORTED prose is the writer's mark, not ours to edit. (the glyphs are
// built from char codes so this file itself stays clean under the sweep.)

const EMDASH = String.fromCharCode(0x2014);
const ENDASH = String.fromCharCode(0x2013);
const LQUOTE = String.fromCharCode(0x2018);
const RQUOTE = String.fromCharCode(0x2019);
const LDBLQUOTE = String.fromCharCode(0x201c);
const RDBLQUOTE = String.fromCharCode(0x201d);
const BULLET = String.fromCharCode(0x2022);
const NBSP = String.fromCharCode(0xa0);

/** the destination groups whose content is plumbing, never prose. */
const SKIP_DESTINATIONS = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "listtable",
  "listoverridetable",
  "revtbl",
  "info",
  "generator",
  "pict",
  "object",
  "themedata",
  "datastore",
  "xmlnstbl",
  "fldinst",
  "header",
  "footer",
]);

/** the control words that emit a character. */
const EMIT: Record<string, string> = {
  par: "\n",
  line: "\n",
  sect: "\n",
  page: "\n",
  row: "\n",
  tab: " ",
  emspace: " ",
  enspace: " ",
  qmspace: " ",
  emdash: EMDASH,
  endash: ENDASH,
  lquote: LQUOTE,
  rquote: RQUOTE,
  ldblquote: LDBLQUOTE,
  rdblquote: RDBLQUOTE,
  bullet: BULLET,
};

interface GroupState {
  skip: boolean;
  uc: number;
}

const CONTROL_WORD = /^([a-z]+)(-?\d+)?/;

/** pull the readable text out of an rtf document. paragraph breaks survive as
 *  newlines; everything else flattens to the writer's own characters. a
 *  malformed document degrades to whatever text was readable ... never throws. */
export function rtfToText(rtf: string): string {
  let out = "";
  const stack: GroupState[] = [];
  let cur: GroupState = { skip: false, uc: 1 };
  let unicodeSkip = 0;
  let i = 0;
  const n = rtf.length;

  while (i < n) {
    const ch = rtf[i]!;

    if (ch === "{") {
      stack.push(cur);
      cur = { ...cur };
      i += 1;
      continue;
    }
    if (ch === "}") {
      cur = stack.pop() ?? { skip: false, uc: 1 };
      i += 1;
      continue;
    }

    if (ch === "\\") {
      const next = rtf[i + 1] ?? "";

      // literal escapes
      if (next === "\\" || next === "{" || next === "}") {
        if (!cur.skip) out += next;
        i += 2;
        continue;
      }
      // a hex byte ... also one "unit" of a pending \u fallback
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        i += 4;
        if (unicodeSkip > 0) {
          unicodeSkip -= 1;
          continue;
        }
        const code = Number.parseInt(hex, 16);
        if (!cur.skip && Number.isFinite(code)) out += String.fromCharCode(code);
        continue;
      }
      if (next === "~") {
        if (!cur.skip) out += NBSP;
        i += 2;
        continue;
      }
      // optional / no-width hyphens ... dropped, the typesetter plants its own
      if (next === "-" || next === "_") {
        i += 2;
        continue;
      }
      // an ignorable destination we don't understand ... skip the group
      if (next === "*") {
        cur.skip = true;
        i += 2;
        continue;
      }
      // \<newline> is a paragraph break alias
      if (next === "\r" || next === "\n") {
        if (!cur.skip) out += "\n";
        i += 2;
        if (next === "\r" && rtf[i] === "\n") i += 1;
        continue;
      }

      const m = CONTROL_WORD.exec(rtf.slice(i + 1, i + 33));
      if (!m) {
        // an unknown control symbol ... skip the backslash + the symbol
        i += 2;
        continue;
      }
      const word = m[1]!;
      const param = m[2] !== undefined ? Number.parseInt(m[2], 10) : null;
      i += 1 + m[0].length;
      // one space after a control word is its terminator, not content
      if (rtf[i] === " ") i += 1;

      if (word === "u" && param !== null) {
        const code = param < 0 ? param + 65536 : param;
        if (!cur.skip) out += String.fromCharCode(code);
        unicodeSkip = cur.uc;
        continue;
      }
      if (word === "uc" && param !== null) {
        cur.uc = Math.max(0, param);
        continue;
      }
      if (SKIP_DESTINATIONS.has(word)) {
        cur.skip = true;
        continue;
      }
      const emit = EMIT[word];
      if (emit && !cur.skip) out += emit;
      continue;
    }

    // raw newlines in the rtf source are file formatting, never content
    if (ch === "\r" || ch === "\n") {
      i += 1;
      continue;
    }
    if (unicodeSkip > 0) {
      unicodeSkip -= 1;
      i += 1;
      continue;
    }
    if (!cur.skip) out += ch;
    i += 1;
  }

  return out;
}

/** the prose as trimmed paragraphs, empties dropped. */
export function rtfToParagraphs(rtf: string): string[] {
  return rtfToText(rtf)
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
}
