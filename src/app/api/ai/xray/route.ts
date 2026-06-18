import { NextResponse, type NextRequest } from "next/server";

import { analyzeStructure } from "@/lib/ai/xray-analyze";
import { reportError } from "@/lib/observability/report-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_BLOCKS = 120;

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

  let blocks: string[];
  try {
    const body = (await request.json()) as { blocks?: unknown };
    if (!Array.isArray(body.blocks)) {
      return NextResponse.json({ ok: false, error: "blocks required" }, { status: 400 });
    }
    blocks = body.blocks.slice(0, MAX_BLOCKS).map((b) => (typeof b === "string" ? b : ""));
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  try {
    const structure = await analyzeStructure(blocks);
    return NextResponse.json({ ok: true, structure });
  } catch (err) {
    reportError(err, { tag: "xray-route-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "couldn't read the structure ... try again in a sec" },
      { status: 502 },
    );
  }
}
