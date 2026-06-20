/**
 * newsletter compose ... pure, db-free, network-free.
 *
 * the persisted repurpose "newsletter" output (np_repurpose_outputs) is a single
 * text body whose first non-empty line is, by the repurpose prompt's contract,
 * "subject: <line>". this splits that into a real email { subject, body },
 * appends the one-tap unsubscribe footer every send must carry, and filters a
 * subscriber list down to the people who may actually be mailed (confirmed, not
 * unsubscribed, deduped). all pure ... unit-tested with zero mocks, and the send
 * path can never disagree with what the writer previews because both read THIS.
 */

// confirmed = "subscribed" in np_subscriber's status lifecycle
// (pending -> subscribed -> unsubscribed). only the confirmed may be mailed.
export const CONFIRMED_STATUS = "subscribed";

const SUBJECT_RE = /^subject:\s*(.+)$/i;
const FALLBACK_SUBJECT = "a new piece";

export interface ParsedNewsletter {
  subject: string;
  body: string;
}

/**
 * split the "subject:" line off the top of a repurpose newsletter body. the
 * first NON-EMPTY line wins; if it is not a subject line we keep the whole body
 * and fall back to a title-derived subject (or a quiet default), so a missing
 * "subject:" degrades to a sendable email rather than an empty subject line.
 */
export function parseNewsletter(raw: string, fallbackSubject?: string): ParsedNewsletter {
  const text = typeof raw === "string" ? raw : "";
  const fallback = (fallbackSubject ?? "").trim() || FALLBACK_SUBJECT;
  const lines = text.split("\n");

  let firstIdx = 0;
  while (firstIdx < lines.length && (lines[firstIdx]?.trim().length ?? 0) === 0) firstIdx++;

  const firstLine = lines[firstIdx];
  if (firstLine !== undefined) {
    const match = firstLine.trim().match(SUBJECT_RE);
    if (match) {
      const subject = (match[1] ?? "").trim() || fallback;
      const body = lines
        .slice(firstIdx + 1)
        .join("\n")
        .trim();
      // a subject-only input (nothing after it) degrades to the whole text as the
      // body rather than mailing an empty message.
      return { subject, body: body.length > 0 ? body : text.trim() };
    }
  }
  return { subject: fallback, body: text.trim() };
}

/**
 * every newsletter carries a one-tap unsubscribe ... it is the law and it is
 * decent. a plain-text footer two lines down with the absolute url. a missing
 * url returns the body untouched (the caller decides whether that is sendable).
 */
export function appendUnsubscribe(body: string, unsubscribeUrl: string): string {
  const base = (typeof body === "string" ? body : "").trimEnd();
  const url = (typeof unsubscribeUrl === "string" ? unsubscribeUrl : "").trim();
  if (!url) return base;
  return `${base}\n\n...\nyou're getting this because you subscribed. unsubscribe: ${url}`;
}

export interface Recipient {
  id: string;
  email: string;
  status: string;
  // the double-opt-in stamp. null = captured but never confirmed (or a legacy
  // single-opt-in row the migration has not backfilled). a real send requires
  // this to be set, so we never blast someone who did not confirm.
  confirmedAt: string | null;
}

/**
 * who may actually be mailed: confirmed AND double-opted-in only ... never
 * "pending"/"unsubscribed" (status gate) and never a row without a confirmed_at
 * stamp (consent gate). the consent gate is deliberately stricter than status
 * alone: a "subscribed" row with no confirmed_at (a legacy single-opt-in capture
 * the migration has not yet backfilled, or a malformed write) is EXCLUDED, not
 * blasted ... the migration backfills legacy confirmed_at so genuine opt-ins
 * still qualify. deduped case-insensitively by email so one person on a list
 * twice is mailed once. pure: the send path and the writer's recipient-count
 * preview both read THIS, so they cannot disagree.
 */
export function eligibleRecipients<T extends Recipient>(
  subs: readonly T[] | null | undefined,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const s of subs ?? []) {
    if (!s || s.status !== CONFIRMED_STATUS) continue;
    const confirmed = typeof s.confirmedAt === "string" && s.confirmedAt.trim().length > 0;
    if (!confirmed) continue;
    const email = typeof s.email === "string" ? s.email.trim().toLowerCase() : "";
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(s);
  }
  return out;
}
