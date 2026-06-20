import { NextResponse, type NextRequest } from "next/server";

import { streamGhost } from "@/lib/ai/ghost";
import { getActiveWritingFork } from "@/lib/db/user-settings";
import { getWriterVoice } from "@/lib/db/voice-profile";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// inline ghost-text endpoint. auth-gated like the rest of the partner ... only
// a signed-in writer spends tokens. validates the context, then streams a
// one-sentence continuation back as plain text. getPartnerModel throws
// synchronously if the provider key is missing, so the catch returns a clean
// 502 and the editor just stays quiet.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  // the whisper streams on keystroke-driven ui, so this is the easiest fan-out
  // to abuse. 60/min lets real typing through (the client already debounces)
  // while killing an automated loop.
  const limit = rateLimit(`ghost:${user.id}`, 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "typing fast ... give it a beat" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { context } = (body ?? {}) as { context?: unknown };
  if (typeof context !== "string" || context.trim().length === 0) {
    return NextResponse.json({ error: "empty context" }, { status: 400 });
  }
  if (context.length > 8000) {
    return NextResponse.json({ error: "context too long" }, { status: 413 });
  }

  try {
    // mirror the writer's own voice into the whisper ... {} when their profile
    // isn't trained yet, which the prompt handles with its honest fallback. the
    // read never throws, so a degraded voice read can't break the ghost.
    const activeFork = await getActiveWritingFork(supabase, user.id);
    const voice = await getWriterVoice(supabase, user.id, activeFork);
    const stream = streamGhost(context, voice.voiceCompactView, voice.exemplars);
    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    reportError(err, { tag: "ai-ghost-failed", userId: user.id });
    return NextResponse.json({ error: "nova couldn't reach the model" }, { status: 502 });
  }
}
