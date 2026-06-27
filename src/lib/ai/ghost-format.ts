/**
 * pure text helpers for ghost text ... no server, react, or ai imports, so the
 * stream layer (lib/ai/ghost.ts) and the overlay (components/editor/ghost-text)
 * can share them and a unit test can hit them directly.
 */

// a standalone sentence-ender (. ! ?) that isn't part of our "..." pause ...
// the lookarounds skip the three dots we swap dashes into.
const SENTENCE_END = /(?<![.])[.!?](?![.])/;

/**
 * where to cut the streamed whisper: the earliest of a hard newline (exclusive,
 * a one-sentence whisper never crosses a paragraph) or a real sentence boundary
 * (inclusive of the mark, so it reads as finished). returns -1 when neither has
 * arrived yet.
 */
export function sentenceCut(text: string): number {
  const nl = text.indexOf("\n");
  const m = SENTENCE_END.exec(text);
  const sentEnd = m ? m.index + 1 : -1;
  if (nl >= 0 && m) return m.index < nl ? sentEnd : nl;
  if (nl >= 0) return nl;
  return sentEnd;
}

/**
 * where to cut a streamed BEAT: the first paragraph break (a blank line),
 * exclusive, so the author writes exactly one beat and never bleeds into the
 * next. returns -1 when no break has arrived yet (the token cap is the backstop).
 * a lone newline inside a beat doesn't cut ... only a real blank-line paragraph
 * boundary does, matching how prose separates paragraphs.
 */
export function paragraphCut(text: string): number {
  const m = /\n[ \t]*\n/.exec(text);
  return m ? m.index : -1;
}

/**
 * turn the raw continuation into what we show and insert. strips a leading
 * space (we decide that ourselves), collapses a boundary double space the
 * per-chunk dash swap can leave, and adds one leading space when the suggestion
 * opens with a word, a quote (straight or curly), or an opening bracket ... not
 * when it opens with closing punctuation. what you see is exactly what tab
 * inserts.
 */
export function joinGhost(ctx: string, raw: string): string {
  const trimmed = raw.replace(/^\s+/, "").replace(/ {2,}/g, " ");
  if (!trimmed) return "";
  const endsSpace = /\s$/.test(ctx);
  const opensWord = /[\p{L}\p{N}"'“‘([{]/u.test(trimmed.charAt(0));
  const needsLead = ctx.length > 0 && !endsSpace && opensWord;
  return (needsLead ? " " : "") + trimmed;
}
