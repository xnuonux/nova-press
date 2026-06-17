import { NextResponse, type NextRequest } from "next/server";

import { streamGhost } from "@/lib/ai/ghost";
import { getWriterVoice } from "@/lib/db/voice-profile";
import { reportError } from "@/lib/observability/report-error";
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
    // mirror the writer's own voice into the whisper ... undefined when their
    // profile isn't trained yet, which the prompt handles with its honest
    // fallback. the read never throws, so a degraded voice read can't break
    // the ghost.
    const voiceCompactView = await getWriterVoice(supabase, user.id);
    const stream = streamGhost(context, voiceCompactView);
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
