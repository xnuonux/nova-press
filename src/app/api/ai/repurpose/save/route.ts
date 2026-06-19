import { NextResponse, type NextRequest } from "next/server";

import { isRepurposeFormat } from "@/lib/ai/prompts/repurpose-prompt";
import { getPieceEditedAt } from "@/lib/db/pieces";
import { saveRepurposeOutput } from "@/lib/db/repurpose-outputs";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_BODY = 20000;

// persist one repurpose output (the living edition). the client sends the FINAL
// audited text (after the voice-keeper pass) for a piece + channel; we record
// the source's last_edited_at as the staleness watermark and upsert, so a
// refresh overwrites the channel's one live output. auth-gated; getPieceEditedAt
// is RLS-scoped, so a writer can only save against a piece they own.
//
// the watermark: the client may pass sourceEditedAt = the piece's last_edited_at
// CAPTURED WHEN GENERATION STARTED (so an autosave landing mid-stream can't make
// a stale output look fresh). we trust it only when it is not NEWER than the
// piece's current last_edited_at ... a forged future watermark would make an
// output never go stale, so it's clamped to the server value.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  const limit = rateLimit(`repurpose-save:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "easy ... give it a second" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let parsed: { pieceId?: unknown; channel?: unknown; body?: unknown; sourceEditedAt?: unknown };
  try {
    parsed = (await request.json()) as typeof parsed;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const { pieceId, channel, body, sourceEditedAt } = parsed;
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
    const serverEditedAt = await getPieceEditedAt(supabase, pieceId);
    if (!serverEditedAt) {
      return NextResponse.json({ ok: false, error: "piece not found" }, { status: 404 });
    }
    // use the client's gen-start watermark only if it's valid and NOT newer than
    // the piece's current state; otherwise fall back to the server value.
    const clientMs = typeof sourceEditedAt === "string" ? Date.parse(sourceEditedAt) : NaN;
    const watermark =
      !Number.isNaN(clientMs) && clientMs <= Date.parse(serverEditedAt)
        ? (sourceEditedAt as string)
        : serverEditedAt;

    const output = await saveRepurposeOutput(supabase, {
      userId: user.id,
      pieceId,
      channel,
      body,
      sourceEditedAt: watermark,
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
