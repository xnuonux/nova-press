import { NextResponse, type NextRequest } from "next/server";

import {
  isRepurposeFormat,
  REPURPOSE_FORMATS,
  type RepurposeFormat,
} from "@/lib/ai/prompts/repurpose-prompt";
import { runRepurposeSet, streamRepurpose } from "@/lib/ai/repurpose";
import { getActiveWritingFork } from "@/lib/db/user-settings";
import { getWriterVoice } from "@/lib/db/voice-profile";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// bound the source so one piece can't run up an unbounded bill.
const MAX_SOURCE = 16000;

// the multi-platform repurpose endpoint. auth-gated ... only a logged-in
// writer can spend tokens. takes a piece's title + plain-text body, recompiles
// it into the requested formats (default: all), each voice-matched + run
// through the voice-keeper. ephemeral ... nothing is persisted, so there's no
// shared-substrate schema involved.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  // the heaviest ai call in the app ... a multi-format batch recompile. the
  // tightest window of the ai routes (12/min) since each call fans out across
  // every channel.
  const limit = rateLimit(`repurpose:${user.id}`, 12, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "easy ... let the last recompile finish" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { title, source, formats, stream } = (body ?? {}) as {
    title?: unknown;
    source?: unknown;
    formats?: unknown;
    stream?: unknown;
  };

  const cleanTitle = typeof title === "string" ? title : "";
  const cleanSource = typeof source === "string" ? source.trim() : "";
  if (cleanSource.length === 0) {
    return NextResponse.json(
      { error: "nothing to repurpose ... write the piece first" },
      { status: 400 },
    );
  }
  if (cleanSource.length > MAX_SOURCE) {
    return NextResponse.json(
      { error: "this piece is too long to repurpose in one pass" },
      { status: 413 },
    );
  }

  // requested formats, filtered to the known set; default to all of them.
  const requested: RepurposeFormat[] = Array.isArray(formats)
    ? formats.filter(isRepurposeFormat)
    : [];
  const targets =
    requested.length > 0 ? requested : (Object.keys(REPURPOSE_FORMATS) as RepurposeFormat[]);

  // the writer's distilled voice (compact line + in-voice exemplars), read once
  // off voice_profiles ... this is what makes "voice-matched on every platform"
  // real instead of the model just imitating the source piece. {} keeps the
  // honest fallback; never throws. an active writing fork re-aims the source to a
  // named strand's snapshot; null = your live voice.
  const activeFork = await getActiveWritingFork(supabase, user.id);
  const voice = await getWriterVoice(supabase, user.id, activeFork);

  // streaming path: one format at a time, text streamed as it generates. the
  // text is dash-safe at the source (streamRepurpose); the client runs the
  // full voice-keeper at stream end.
  if (stream === true) {
    const [only] = targets;
    if (!only || targets.length !== 1) {
      return NextResponse.json({ error: "streaming takes one format at a time" }, { status: 400 });
    }
    try {
      const responseStream = streamRepurpose(only, {
        title: cleanTitle,
        source: cleanSource,
        voiceCompactView: voice.voiceCompactView,
        exemplars: voice.exemplars,
      });
      return new Response(responseStream, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    } catch (err) {
      reportError(err, { tag: "ai-repurpose-stream-failed", userId: user.id });
      return NextResponse.json({ error: "nova couldn't repurpose this one" }, { status: 502 });
    }
  }

  try {
    const variants = await runRepurposeSet(targets, {
      title: cleanTitle,
      source: cleanSource,
      voiceCompactView: voice.voiceCompactView,
      exemplars: voice.exemplars,
    });
    return NextResponse.json({ variants });
  } catch (err) {
    reportError(err, { tag: "ai-repurpose-failed", userId: user.id });
    return NextResponse.json({ error: "nova couldn't repurpose this one" }, { status: 502 });
  }
}
