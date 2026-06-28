import { NextResponse, type NextRequest } from "next/server";

import { listOpenFlags, scanPiece } from "@/lib/db/continuity";
import { getPieceById } from "@/lib/db/pieces";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// np_pieces.id is a uuid ... a non-uuid would throw a postgres 22P02 on the
// lookup, so a cheap shape guard keeps a malformed id a clean 400.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// the on-demand per-piece continuity scan ... the DETERMINISTIC pass (no model)
// over one piece. auth-gated + owner-scoped (getPieceById is RLS-gated). unlike
// the whole-work scan this never calls a model, so the window is roomier. the same
// scanPiece autosave runs ambiently; this is the explicit "check this piece now".
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  // no model call here, so the window is roomier than the whole-work scan's 6/min.
  const limit = rateLimit(`continuity-piece:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "give the last scan a moment" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const { pieceId } = (body ?? {}) as { pieceId?: unknown };
  if (typeof pieceId !== "string" || !UUID_RE.test(pieceId)) {
    return NextResponse.json({ ok: false, error: "which piece?" }, { status: 400 });
  }

  // owner-scoped: a piece that isn't the caller's reads as null (RLS).
  const piece = await getPieceById(supabase, pieceId);
  if (!piece) {
    return NextResponse.json({ ok: false, error: "piece not found" }, { status: 404 });
  }

  try {
    const result = await scanPiece(supabase, user.id, pieceId);
    const flags = piece.work_id ? await listOpenFlags(supabase, piece.work_id) : [];
    return NextResponse.json({ ok: true, ...result, flags });
  } catch (err) {
    reportError(err, { tag: "continuity-scan-piece-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "couldn't scan that piece ... try again in a sec" },
      { status: 502 },
    );
  }
}
