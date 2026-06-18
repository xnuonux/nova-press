import { NextResponse, type NextRequest } from "next/server";

import { analyzeStructure } from "@/lib/ai/xray-analyze";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_BLOCKS = 120;
const MAX_BLOCK_CHARS = 4000;

// the x-ray ... auth-gated. the client sends the current draft's block texts (in
// order), nova returns the argument's structure (a role per block + promise ->
// payoff threads). the draft lives in the unsaved editor, so it rides in the
// request body rather than a db read; nothing is persisted server-side.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  // an x-ray is a real llm call; a writer shouldn't fire many a minute. a
  // per-user fixed window keeps a mashed toggle (or a script) from running up
  // cost ... the client also guards against double-fire, this is the backstop.
  const limit = rateLimit(`xray:${user.id}`, 12, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "easy ... give the last read a second" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let blocks: string[];
  try {
    const body = (await request.json()) as { blocks?: unknown };
    if (!Array.isArray(body.blocks)) {
      return NextResponse.json({ ok: false, error: "blocks required" }, { status: 400 });
    }
    // cap the count AND each block's size before anything touches it ... the
    // model only reads the first 800 chars/block anyway, so a giant paste is
    // never worth holding in full.
    blocks = body.blocks
      .slice(0, MAX_BLOCKS)
      .map((b) => (typeof b === "string" ? b.slice(0, MAX_BLOCK_CHARS) : ""));
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  try {
    const { structure, failed } = await analyzeStructure(blocks);
    return NextResponse.json({ ok: true, structure, degraded: failed });
  } catch (err) {
    reportError(err, { tag: "xray-route-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "couldn't read the structure ... try again in a sec" },
      { status: 502 },
    );
  }
}
