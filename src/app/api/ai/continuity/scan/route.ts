import { NextResponse, type NextRequest } from "next/server";

import { listOpenFlags, scanWork } from "@/lib/db/continuity";
import { getWorkById } from "@/lib/db/works";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// np_works.id is a uuid ... a non-uuid would throw a postgres 22P02 on the
// lookup, so a cheap shape guard keeps a malformed id a clean 400.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// scan a work for continuity concerns. auth-gated + owner-scoped (getWorkById is
// RLS-gated, so a stranger's work is a 404). a scan runs a model call over the
// whole work, so the rate window is tight. the scan itself is resumable +
// skip-if-unchanged (np_continuity_scans), so a re-fire over an unedited work
// costs nothing.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  // a scan is the most expensive ai call in nova (a model read over the whole
  // work), so the window is the tightest ... a few a minute, no mashing.
  const limit = rateLimit(`continuity:${user.id}`, 6, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "give the last scan a moment to land" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const { workId } = (body ?? {}) as { workId?: unknown };
  if (typeof workId !== "string" || !UUID_RE.test(workId)) {
    return NextResponse.json({ ok: false, error: "which work?" }, { status: 400 });
  }

  // owner-scoped: a work that isn't the caller's reads as null (RLS).
  const work = await getWorkById(supabase, workId);
  if (!work) {
    return NextResponse.json({ ok: false, error: "work not found" }, { status: 404 });
  }

  try {
    const result = await scanWork(supabase, user.id, workId);
    // hand back the work's open flags so the rail renders the result without a
    // second round-trip ... the same owner-scoped read the page loads with.
    const flags = await listOpenFlags(supabase, workId);
    return NextResponse.json({ ok: true, ...result, flags });
  } catch (err) {
    reportError(err, { tag: "continuity-scan-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "couldn't finish that scan ... try again in a sec" },
      { status: 502 },
    );
  }
}
