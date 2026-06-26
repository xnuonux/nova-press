import { NextResponse } from "next/server";

import { extractVoiceProfile } from "@/lib/ai/voice-extract";
import { listPieceTextsForUser, listPieceTextsForWork } from "@/lib/db/pieces";
import { saveWriterVoice } from "@/lib/db/voice-profile";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// "train nova on your voice". auth-gated ... a writer extracts the fingerprint
// of their OWN pieces into voice_profiles, which then feeds the partner, the
// ghost whisper, and the repurpose engine. reads + writes go through the authed
// client (voice_profiles has owner select/insert/update on auth.uid()=user_id),
// never the service role, so a writer can only train their own voice.
//
// an optional { workId } in the body scopes the SOURCE to one Work's prose: a
// novel's voice distilled from the novel, not the whole library. the result
// still lands in the one voice_profiles row (last-writer-wins, CLAUDE.md). a
// missing / malformed body falls back to the library-wide read, so the existing
// no-body POST is byte-for-byte unchanged.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  // training runs the voice model over the source ... expensive and rare. 6/hour
  // per user fits the profile and stops a mashed train button from running up
  // real cost (the per-user key bounds total spend across library + work trains).
  const limit = rateLimit(`voice-extract:${user.id}`, 6, 3_600_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "you just trained ... give it a bit before the next read" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  // a uuid shape-check so a malformed workId falls back to the library read
  // (matching the missing / whitespace cases the comment promises) instead of
  // reaching postgres and 502-ing on an invalid-uuid cast. the real UI always
  // sends a true work.id, so this only catches hand-crafted / buggy input.
  const body = (await request.json().catch(() => ({}))) as { workId?: unknown };
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rawWorkId = typeof body.workId === "string" ? body.workId.trim() : "";
  const workId = UUID_RE.test(rawWorkId) ? rawWorkId : null;

  try {
    const samples = workId
      ? await listPieceTextsForWork(supabase, workId, 8)
      : await listPieceTextsForUser(supabase, 8);
    if (samples.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: workId
            ? "write a page or two in this work first ... nova learns its voice from its own words"
            : "write a piece or two first ... nova learns your voice from your own words",
        },
        { status: 400 },
      );
    }

    const extracted = await extractVoiceProfile(samples);
    await saveWriterVoice(supabase, user.id, extracted);

    return NextResponse.json({
      ok: true,
      scope: workId ? "work" : "library",
      samples: extracted.samples_count,
      summary: extracted.summary,
      register: extracted.register,
      confidence: extracted.confidence,
    });
  } catch (err) {
    reportError(err, { tag: "voice-extract-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "couldn't train your voice ... try again in a sec" },
      { status: 502 },
    );
  }
}
