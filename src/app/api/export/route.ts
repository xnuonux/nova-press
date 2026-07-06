import { NextResponse } from "next/server";

import { coercePlateValue } from "@/components/editor/plate-text";
import { recordExport } from "@/lib/db/exports";
import { getPieceById } from "@/lib/db/pieces";
import { fileSlug } from "@/lib/io/filename";
import { slateToMarkdown } from "@/lib/io/markdown";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function filenameFor(title: string): string {
  return `${fileSlug(title, "piece")}.md`;
}

// export a piece OUT of Slate JSON. phase 0.3 ships markdown; the html hub
// (docx / epub / print-pdf) lands in later phases through the same route shape.
// getPieceById is RLS-scoped, so a writer only exports their own piece ... a
// stranger's id returns null (a 404), never a 403 existence oracle.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  const limit = rateLimit(`export:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "slow down a touch ... try the export again in a moment" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  // hoisted so the failure receipt can still name the piece.
  let pieceId = "";
  try {
    const payload = (await request.json()) as { pieceId?: unknown; format?: unknown };
    pieceId = typeof payload.pieceId === "string" ? payload.pieceId : "";
    if (!pieceId) {
      return NextResponse.json({ ok: false, error: "which piece?" }, { status: 400 });
    }
    const format = typeof payload.format === "string" ? payload.format : "markdown";
    if (format !== "markdown" && format !== "md") {
      return NextResponse.json(
        { ok: false, error: `${format} export is coming ... markdown is live now` },
        { status: 400 },
      );
    }

    const piece = await getPieceById(supabase, pieceId);
    if (!piece) {
      return NextResponse.json({ ok: false, error: "piece not found" }, { status: 404 });
    }

    const markdown = slateToMarkdown(coercePlateValue(piece.body));
    await recordExport(supabase, user.id, {
      pieceId,
      format: "markdown",
      ok: true,
      byteSize: Buffer.byteLength(markdown, "utf8"),
    });
    return NextResponse.json({
      ok: true,
      markdown,
      title: piece.title,
      filename: filenameFor(piece.title),
    });
  } catch (err) {
    reportError(err, { tag: "export-failed", userId: user.id });
    await recordExport(supabase, user.id, {
      pieceId: pieceId || null,
      format: "markdown",
      ok: false,
      detail: err instanceof Error ? err.message : "export failed",
    });
    return NextResponse.json(
      { ok: false, error: "couldn't export that ... give it another go" },
      { status: 502 },
    );
  }
}
