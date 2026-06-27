import { NextResponse } from "next/server";

import type { VoiceStats } from "@/lib/ai/voice-stats";
import { coercePlateValue } from "@/components/editor/plate-text";
import { upsertPass } from "@/lib/db/editorial";
import { getPieceById } from "@/lib/db/pieces";
import { readVoiceCard } from "@/lib/db/voice-profile";
import { deriveBlocks } from "@/lib/editorial/lenses/core";
import { lensesForStage, runStage } from "@/lib/editorial/lenses/registry";
import { isEditorialStage } from "@/lib/editorial/stages";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// run an editorial pass over a piece at its current craft stage. the deterministic
// lenses (mechanical / readability / voice-drift) run for free over the SAVED
// body (the client autosaves first), measured against the writer's own voice
// baseline; the result is upserted as the stage's current pass, watermarked to
// the piece's last_edited_at so it goes stale the moment the writer edits past
// it. owner-scoped: getPieceById is RLS-gated, so a stranger's id is a 404.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  // a pass is cheap (deterministic), but the model lenses + the upsert still cost
  // a little; a per-user window stops a mashed button from churning.
  const limit = rateLimit(`editor-pass:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "easy ... give the last pass a moment" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const payload = (await request.json()) as { pieceId?: unknown };
    const pieceId = typeof payload.pieceId === "string" ? payload.pieceId : "";
    if (!pieceId) {
      return NextResponse.json({ ok: false, error: "which piece?" }, { status: 400 });
    }

    const piece = await getPieceById(supabase, pieceId);
    if (!piece) {
      return NextResponse.json({ ok: false, error: "piece not found" }, { status: 404 });
    }

    const stage = isEditorialStage(piece.editorial_stage) ? piece.editorial_stage : "drafting";

    // the writer's resolved voice baseline (untrained -> null, so the voice
    // lenses stay quiet rather than inventing a generic grade).
    const card = await readVoiceCard(supabase, user.id);
    const voiceBaseline: VoiceStats | null = card
      ? {
          sentence_length_avg: card.sentenceLengthAvg,
          sentence_length_variance: card.sentenceLengthVariance,
          paragraph_length_avg: card.paragraphLengthAvg,
          paragraph_length_variance: null,
          punctuation_style: {},
          emoji_signature: { count: 0, per_1000_words: 0 },
        }
      : null;

    const blocks = deriveBlocks(coercePlateValue(piece.body));
    const findings = runStage(stage, { blocks, voiceBaseline });
    const lensKeys = lensesForStage(stage).map((d) => d.key);

    const pass = await upsertPass(supabase, user.id, {
      pieceId,
      stage,
      findings,
      lensKeys,
      sourceEditedAt: piece.last_edited_at,
    });

    return NextResponse.json({
      ok: true,
      stage,
      findings: pass.findings,
      generatedAt: pass.generatedAt,
    });
  } catch (err) {
    reportError(err, { tag: "editor-pass-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "couldn't run that pass ... try again in a sec" },
      { status: 502 },
    );
  }
}
