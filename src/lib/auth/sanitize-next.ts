// sanitize a user-controllable `next` query param into either a safe
// same-origin path or undefined. defends against the open-redirect bypass
// family the substrate audit caught:
//   - //evil.com           (protocol-relative)
//   - /\evil.com           (whatwg url parsers normalize \ to / inside paths)
//   - /\t/evil.com, /\n/.. (control bytes can escape into authority)
//   - https://evil.com     (absolute url)
//   - javascript:..., data:.. (non-http schemes)
//   - library, ./library   (paths without explicit leading slash)
//
// both /login and /auth/callback use this same helper so the two redirect
// surfaces can never drift.

const SAFE_BASE = "https://nova.invalid";

export function sanitizeNextPath(next: string | null | undefined): string | undefined {
  if (!next) return undefined;
  // reject backslash and any control byte outright.
  if (/[\x00-\x1f\\]/.test(next)) return undefined;
  // require an explicit leading slash. catches "library", "./library",
  // "javascript:...", "https://..." before url parsing.
  if (!next.startsWith("/")) return undefined;
  try {
    const parsed = new URL(next, SAFE_BASE);
    // protocol-relative "//evil.com" lands here as origin mismatch.
    if (parsed.origin !== SAFE_BASE) return undefined;
    // edge-case whatwg normalization can still produce a pathname that
    // starts with "//", which would be protocol-relative when emitted in
    // a Location header.
    if (parsed.pathname.startsWith("//")) return undefined;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return undefined;
  }
}
