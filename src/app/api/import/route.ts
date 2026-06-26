import { NextResponse } from "next/server";

import type { Value } from "platejs";

import { coercePlateValue, deriveExcerpt, plateText } from "@/components/editor/plate-text";
import { createDraftPiece, savePieceContent, type PieceContentUpdate } from "@/lib/db/pieces";
import { markdownToSlate } from "@/lib/io/markdown";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// a 2MB cap ... a whole manuscript fits; a runaway upload does not.
const MAX_MARKDOWN_BYTES = 2_000_000;

function wordCount(value: Value): number {
  return plateText(value).trim().split(/\s+/).filter(Boolean).length;
}

// the first non-empty line becomes the title (a markdown `# heading` reads
// nicely once its `#` is stripped by the deserializer). capped, with a fallback.
function firstLineTitle(value: Value): string {
  const line = plateText(value)
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return "untitled";
  return line.length > 80 ? line.slice(0, 80).trimEnd() : line;
}

// import markdown INTO a new piece. Slate JSON is the source of truth ... the
// markdown is converted to a plate value once, here, and never stored as
// markdown. auth-gated; createDraftPiece stamps user_id, so the new piece lands
// in the caller's own library like any draft.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  const limit = rateLimit(`import:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "slow down a touch ... try the import again in a moment" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const payload = (await request.json()) as { markdown?: unknown; title?: unknown };
    const markdown = typeof payload.markdown === "string" ? payload.markdown : "";
    if (markdown.length > MAX_MARKDOWN_BYTES) {
      return NextResponse.json(
        { ok: false, error: "that file is a little large to import" },
        { status: 413 },
      );
    }

    const value = coercePlateValue(markdownToSlate(markdown));
    const title =
      typeof payload.title === "string" && payload.title.trim()
        ? payload.title.trim()
        : firstLineTitle(value);

    const { id } = await createDraftPiece(supabase, user.id);
    const update: PieceContentUpdate = {
      title,
      body: value as unknown as PieceContentUpdate["body"],
      word_count: wordCount(value),
      excerpt: deriveExcerpt(value),
    };
    await savePieceContent(supabase, id, update);

    return NextResponse.json({ ok: true, pieceId: id, title });
  } catch (err) {
    reportError(err, { tag: "import-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "couldn't import that ... give it another go" },
      { status: 502 },
    );
  }
}
