import { NextResponse, type NextRequest } from "next/server";

import { getPieceEditedAt } from "@/lib/db/pieces";
import { isOutputStale, listOutputsByPiece } from "@/lib/db/repurpose-outputs";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// the saved repurpose outputs for a piece + the piece's current last_edited_at,
// so the client can compute staleness on read (source_edited_at < this) AND use
// that timestamp as the gen-start watermark for any fresh generation it kicks
// off. on panel open the launcher shows these instead of regenerating,
// drift-aware. auth-gated; getPieceEditedAt is RLS-scoped (ownership + watermark).
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  const limit = rateLimit(`repurpose-outputs:${user.id}`, 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "easy ... give it a second" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const pieceId = request.nextUrl.searchParams.get("pieceId");
  if (!pieceId) {
    return NextResponse.json({ ok: false, error: "pieceId required" }, { status: 400 });
  }

  try {
    const pieceLastEditedAt = await getPieceEditedAt(supabase, pieceId);
    if (!pieceLastEditedAt) {
      return NextResponse.json({ ok: false, error: "piece not found" }, { status: 404 });
    }
    // staleness is computed here, on read, against the piece's current
    // last_edited_at ... the client just reads the flag, never the timestamps.
    const outputs = (await listOutputsByPiece(supabase, pieceId)).map((o) => ({
      ...o,
      stale: isOutputStale(o, pieceLastEditedAt),
    }));
    return NextResponse.json({ ok: true, pieceLastEditedAt, outputs });
  } catch (err) {
    reportError(err, { tag: "repurpose-outputs-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "couldn't load your saved versions" },
      { status: 502 },
    );
  }
}
