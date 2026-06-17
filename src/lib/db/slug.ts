/**
 * slug helpers for published pieces. pure, so they're unit-tested without a db.
 * /p/[slug] is a global namespace (the partial unique index on np_pieces
 * enforces it), so publishPiece resolves real uniqueness against postgres ...
 * these just shape a clean, url-safe candidate.
 */

const MAX_SLUG_LEN = 80;

/**
 * turn a title into a clean, url-safe slug: lowercased, accents stripped,
 * runs of non-alphanumerics folded to single hyphens, trimmed, length-capped.
 * empty or punctuation-only titles fall back to "untitled".
 */
export function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // drop combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // anything else becomes a hyphen
    .replace(/^-+/, "")
    .slice(0, MAX_SLUG_LEN)
    .replace(/-+$/, ""); // re-trim a hyphen the slice may have exposed
  return base || "untitled";
}

/**
 * a disambiguating candidate when the clean slug is already taken. keeps the
 * base readable and appends a short token; stays within the length cap.
 */
export function slugWithSuffix(base: string, suffix: string): string {
  const room = MAX_SLUG_LEN - suffix.length - 1;
  const trimmed = base.slice(0, Math.max(1, room)).replace(/-+$/, "");
  return `${trimmed || "untitled"}-${suffix}`;
}
