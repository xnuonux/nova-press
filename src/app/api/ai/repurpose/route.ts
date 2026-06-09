import { NextResponse, type NextRequest } from "next/server";

import {
  isRepurposeFormat,
  REPURPOSE_FORMATS,
  type RepurposeFormat,
} from "@/lib/ai/prompts/repurpose-prompt";
import { runRepurposeSet } from "@/lib/ai/repurpose";
import { reportError } from "@/lib/observability/report-error";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { title, source, formats } = (body ?? {}) as {
    title?: unknown;
    source?: unknown;
    formats?: unknown;
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

  try {
    const variants = await runRepurposeSet(targets, {
      title: cleanTitle,
      source: cleanSource,
    });
    return NextResponse.json({ variants });
  } catch (err) {
    reportError(err, { tag: "ai-repurpose-failed", userId: user.id });
    return NextResponse.json({ error: "nova couldn't repurpose this one" }, { status: 502 });
  }
}
