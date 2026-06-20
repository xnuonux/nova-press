import { NextResponse, type NextRequest } from "next/server";

import {
  fixedLineStream,
  planVoiceAsk,
  streamVoiceAsk,
  voiceTextureFromSnapshot,
} from "@/lib/ai/voice-ask";
import { listVoiceSnapshots } from "@/lib/db/voice-snapshots";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeVoiceDrift } from "@/lib/voice/drift";

const MAX_QUESTION = 600;

// byte-for-byte the command/repurpose streaming header set.
const STREAM_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

// the interrogable voiceprint. a writer asks how their voice has changed and nova
// answers, grounded in their OWN immutable snapshots, in nova's voice, never
// inventing a number. read-only over chunk-1's np_voice_snapshots ... no schema,
// no write, no service role. all math is in pure drift.ts; the model narrates.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  const limit = rateLimit(`voice-ask:${user.id}`, 12, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "easy ... give it a second" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let parsed: { question?: unknown; snapshotIds?: unknown };
  try {
    parsed = (await request.json()) as typeof parsed;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const { question, snapshotIds } = parsed;
  if (typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "ask me something" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION) {
    return NextResponse.json(
      { ok: false, error: "that's a long one ... trim it down" },
      { status: 413 },
    );
  }

  // optional: the two pinned dots. validated to exactly two distinct non-empty
  // strings; they're resolved by find() over the RLS-scoped list in planVoiceAsk.
  let ids: [string, string] | undefined;
  if (snapshotIds !== undefined) {
    if (!Array.isArray(snapshotIds) || snapshotIds.length !== 2) {
      return NextResponse.json(
        { ok: false, error: "pick two different readings" },
        { status: 400 },
      );
    }
    const a = snapshotIds[0];
    const b = snapshotIds[1];
    if (
      typeof a !== "string" ||
      typeof b !== "string" ||
      a.length === 0 ||
      b.length === 0 ||
      a === b
    ) {
      return NextResponse.json(
        { ok: false, error: "pick two different readings" },
        { status: 400 },
      );
    }
    ids = [a, b];
  }

  try {
    // RLS-scoped to the caller's OWN rows on the authed client; user.id is from
    // the verified session, never the request body. ids resolve by find() over
    // this list, so a forged / foreign / deleted id is simply absent.
    const all = await listVoiceSnapshots(supabase, user.id);
    const plan = planVoiceAsk(all, ids);

    if (plan.kind === "degrade") {
      // spend-free: a fixed honest line, NO model call. a single data point can
      // never be spun into a trend because the model is never invoked.
      return new Response(fixedLineStream(plan.line), { headers: STREAM_HEADERS });
    }

    const report = computeVoiceDrift(plan.older, plan.newer);
    const voiceCompactView = voiceTextureFromSnapshot(plan.newer);
    // getPartnerModel() throws synchronously on a missing key (inside
    // streamVoiceAsk), so the catch below lands a clean 502 BEFORE any byte goes.
    const stream = streamVoiceAsk({
      question: question.trim(),
      older: plan.older,
      newer: plan.newer,
      report,
      voiceCompactView,
    });
    return new Response(stream, { headers: STREAM_HEADERS });
  } catch (err) {
    reportError(err, { tag: "voice-ask-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "nova couldn't reach the model" },
      { status: 502 },
    );
  }
}
