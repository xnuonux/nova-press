import { NextResponse, type NextRequest } from "next/server";

import { isRepurposeFormat } from "@/lib/ai/prompts/repurpose-prompt";
import { getPieceEditedAt } from "@/lib/db/pieces";
import { saveRepurposeOutput } from "@/lib/db/repurpose-outputs";
import { reportError } from "@/lib/observability/report-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_BODY = 20000;

// persist one repurpose output (the living edition). the client sends the FINAL
// audited text (after the voice-keeper pass) for a piece + channel; we capture
// the piece's last_edited_at as the staleness watermark and upsert, so a refresh
// overwrites the channel's one live output. auth-gated; getPieceEditedAt is
// RLS-scoped, so a writer can only save against a piece they own.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  let parsed: { pieceId?: unknown; channel?: unknown; body?: unknown };
  try {
    parsed = (await request.json()) as typeof parsed;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const { pieceId, channel, body } = parsed;
  if (
    typeof pieceId !== "string" ||
    !isRepurposeFormat(channel) ||
    typeof body !== "string" ||
    body.trim().length === 0
  ) {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }
  if (body.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "too long to save" }, { status: 413 });
  }

  try {
    const sourceEditedAt = await getPieceEditedAt(supabase, pieceId);
    if (!sourceEditedAt) {
      return NextResponse.json({ ok: false, error: "piece not found" }, { status: 404 });
    }
    const output = await saveRepurposeOutput(supabase, {
      userId: user.id,
      pieceId,
      channel,
      body,
      sourceEditedAt,
    });
    if (!output) {
      return NextResponse.json({ ok: false, error: "couldn't save it" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    reportError(err, { tag: "repurpose-save-failed", userId: user.id });
    return NextResponse.json({ ok: false, error: "couldn't save it" }, { status: 502 });
  }
}
