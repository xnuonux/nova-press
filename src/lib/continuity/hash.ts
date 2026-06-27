// the work-content fingerprint that makes a continuity scan resumable +
// skip-if-unchanged. it clones the dispatch edition hash (email/dispatch.ts): a
// dep-free FNV-1a over the normalized prose, two passes + the length, so a small
// edit reliably moves it. it only needs to change when the scanned content
// changes, not to be cryptographic. keyed into np_continuity_scans
// (work_id, body_hash): an unchanged work hashes the same (skip the re-scan), an
// edit is a new hash = a new scan. pure + unit-tested.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a(input: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** a short stable hex fingerprint of a work's scanned content. whitespace is
 *  normalized so a trailing newline doesn't read as a change. */
export function contentHash(text: string): string {
  const norm = (typeof text === "string" ? text : "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  const a = fnv1a(norm);
  // a reversed second pass catches some collisions the forward pass misses.
  const b = fnv1a(norm.split("").reverse().join(""));
  const len = norm.length >>> 0;
  return [a, b, len].map((n) => n.toString(16).padStart(8, "0")).join("");
}
