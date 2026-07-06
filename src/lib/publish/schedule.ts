// nova press · the mythos · scheduled publishing (the pure rules).
//
// the craft: "publish at dawn" without staying up until dawn. a piece flips to
// status 'scheduled' with a future timestamp; the worker sweep flips every due
// row to published. these are the exact rules both ends agree on ... what
// counts as a valid schedule time, and what counts as due. no db, no react,
// unit-tested like the ladder.

/** the floor ... "now" is what the publish button is for; a schedule at least
 *  stands a minute out so the intent is unambiguous. */
export const MIN_SCHEDULE_LEAD_MS = 60_000;

/** the ceiling ... a year out is patience; past it is almost certainly a typo
 *  in the date field. */
export const MAX_SCHEDULE_LEAD_MS = 366 * 24 * 60 * 60 * 1000;

export type ScheduleCheck = { ok: true; whenIso: string } | { ok: false; error: string };

/**
 * validate a requested publish time against "now". accepts anything
 * Date.parse can read (the datetime-local input's value included) and returns
 * the canonical iso string that lands in scheduled_publish_at.
 */
export function parseScheduleInput(when: unknown, nowIso: string): ScheduleCheck {
  if (typeof when !== "string" || !when.trim()) {
    return { ok: false, error: "pick a time to publish" };
  }
  const at = Date.parse(when);
  const now = Date.parse(nowIso);
  if (Number.isNaN(at) || Number.isNaN(now)) {
    return { ok: false, error: "that time didn't read ... pick it again" };
  }
  if (at < now + MIN_SCHEDULE_LEAD_MS) {
    return { ok: false, error: "that's basically now ... just publish, or pick a later time" };
  }
  if (at > now + MAX_SCHEDULE_LEAD_MS) {
    return { ok: false, error: "more than a year out ... check the date" };
  }
  return { ok: true, whenIso: new Date(at).toISOString() };
}

/** is this row's moment here? due = still scheduled AND its time has arrived.
 *  a malformed timestamp is never due (the sweep must not fire on garbage). */
export function isDueForPublish(
  row: { status: string; scheduledPublishAt: string | null },
  nowIso: string,
): boolean {
  if (row.status !== "scheduled" || !row.scheduledPublishAt) return false;
  const at = Date.parse(row.scheduledPublishAt);
  const now = Date.parse(nowIso);
  if (Number.isNaN(at) || Number.isNaN(now)) return false;
  return at <= now;
}
