import { NextResponse } from "next/server";

import { extractVoiceProfile } from "@/lib/ai/voice-extract";
import { listPieceTextsForUser } from "@/lib/db/pieces";
import { saveWriterVoice } from "@/lib/db/voice-profile";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// "train nova on your voice". auth-gated ... a writer extracts the fingerprint
// of their OWN pieces into voice_profiles, which then feeds the partner, the
// ghost whisper, and the repurpose engine. reads + writes go through the authed
// client (voice_profiles has owner select/insert/update on auth.uid()=user_id),
// never the service role, so a writer can only train their own voice.
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  // training runs the voice model over the whole library ... expensive and
  // rare. 6/hour fits the profile and stops a mashed train button from running
  // up real cost.
  const limit = rateLimit(`voice-extract:${user.id}`, 6, 3_600_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "you just trained ... give it a bit before the next read" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const samples = await listPieceTextsForUser(supabase, 8);
    if (samples.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "write a piece or two first ... nova learns your voice from your own words",
        },
        { status: 400 },
      );
    }

    const extracted = await extractVoiceProfile(samples);
    await saveWriterVoice(supabase, user.id, extracted);

    return NextResponse.json({
      ok: true,
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
