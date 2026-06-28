import { NextResponse, type NextRequest } from "next/server";

import { coercePlateValue, plateText } from "@/components/editor/plate-text";
import { streamAuthor } from "@/lib/ai/author";
import { isAuthorTask } from "@/lib/ai/provider";
import { readBibleForWorkMentioned } from "@/lib/db/bible";
import { getPieceById } from "@/lib/db/pieces";
import { getActiveWritingFork } from "@/lib/db/user-settings";
import { getWriterVoice } from "@/lib/db/voice-profile";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// how much of the piece-so-far grounds a beat (and is the source an outline
// scaffolds). bounded so a long manuscript can't run up the token bill.
const DOC_LIMIT = 6000;
const CONTEXT_LIMIT = 4000;

// np_pieces.id is a uuid column ... a non-uuid pieceId would make the lookup
// throw a postgres 22P02 (which getPieceById, called before the try, would
// surface as a raw 500). a cheap shape guard keeps a malformed id a clean 4xx,
// indistinguishable from a not-owned id (no existence oracle).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// the ai AUTHOR endpoint. auth-gated + per-user rate-limited like the rest of
// the partner ... a beat is a real llm call. owner-scoped: getPieceById is
// RLS-gated, so a stranger's id is a 404 and the author can only ever write into
// the writer's own piece. it streams a beat (or an outline) IN the writer's
// resolved voice, dash-safe at the source, the way the ghost + repurpose paths
// stream. getPartnerModel throws synchronously on a missing key, so a config
// failure still lands as a clean 502 before any bytes go out.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  // a beat is a real generation ... a per-user window keeps a mashed button (or
  // a script) from running up the bill. same room as the partner command.
  const limit = rateLimit(`author:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "easy ... let nova finish the last beat" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const {
    pieceId,
    task,
    context: rawContext,
  } = (body ?? {}) as {
    pieceId?: unknown;
    task?: unknown;
    context?: unknown;
  };

  if (!isAuthorTask(task)) {
    return NextResponse.json({ error: "unknown task" }, { status: 400 });
  }
  if (typeof pieceId !== "string" || !UUID_RE.test(pieceId)) {
    return NextResponse.json({ error: "which piece?" }, { status: 400 });
  }

  const context = typeof rawContext === "string" ? rawContext.slice(0, CONTEXT_LIMIT).trim() : "";
  // expand + draft-beat act ON a note/beat ... without one there's nothing to
  // realize. an outline scaffolds the piece so far + a coin fits the poem so far,
  // so those two are allowed to be bare (they lean on the document).
  const leansOnDocument = task === "outline" || task === "coin";
  if (!leansOnDocument && context.length === 0) {
    return NextResponse.json({ error: "give nova a note to work from" }, { status: 400 });
  }

  // owner-scoped: a piece that isn't the caller's reads as null (RLS), so the
  // author can never write off a stranger's draft.
  const piece = await getPieceById(supabase, pieceId);
  if (!piece) {
    return NextResponse.json({ error: "piece not found" }, { status: 404 });
  }

  // the piece so far grounds the beat (and is the source an outline scaffolds),
  // bounded so a long manuscript stays within the token budget.
  const document = plateText(coercePlateValue(piece.body)).slice(0, DOC_LIMIT).trim() || undefined;

  // an outline / coin with no seed AND a blank canvas has nothing to work from
  // ... fail soft rather than spend tokens on empty air.
  if (leansOnDocument && context.length === 0 && !document) {
    return NextResponse.json({ error: "write a line or two first" }, { status: 400 });
  }

  try {
    // mirror the writer's own resolved voice into the beat ... {} when untrained,
    // which the prompt handles with its honest fallback. the active writing fork
    // re-aims the source to a named strand's snapshot. the read never throws.
    const activeFork = await getActiveWritingFork(supabase, user.id);
    const voice = await getWriterVoice(supabase, user.id, activeFork);
    // the world bible, NARROWED to what this beat names (retrieval-by-mention) ...
    // when the piece belongs to a work, fold ONLY the entities the note + the piece
    // so far mention into the reserved prompt slot, so a drafted beat / coined line
    // stays in-world without flooding the prompt with the whole cast. "" for a
    // standalone library piece, an empty bible, or a beat that names nothing
    // established; the read never throws.
    const mentionSource = `${context}\n\n${document ?? ""}`;
    const bible = piece.work_id
      ? await readBibleForWorkMentioned(supabase, piece.work_id, mentionSource)
      : "";
    const stream = streamAuthor({
      task,
      title: piece.title,
      context,
      document,
      voiceCompactView: voice.voiceCompactView,
      exemplars: voice.exemplars,
      bible: bible || undefined,
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    reportError(err, { tag: "ai-author-failed", task, userId: user.id });
    return NextResponse.json({ error: "nova couldn't reach the model" }, { status: 502 });
  }
}
