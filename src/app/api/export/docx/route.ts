import { NextResponse } from "next/server";

import { coercePlateValue } from "@/components/editor/plate-text";
import { recordExport } from "@/lib/db/exports";
import { getPieceById } from "@/lib/db/pieces";
import { getWorkSectionsForOwner } from "@/lib/db/works";
import { slateToDocx, sectionsToDocx } from "@/lib/io/docx";
import { fileSlug } from "@/lib/io/filename";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function docxResponse(buffer: Buffer, name: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": DOCX_MIME,
      "content-disposition": `attachment; filename="${name}.docx"`,
      "cache-control": "no-store",
    },
  });
}

// export a piece OR a whole Work OUT of Slate JSON as a real .docx. owner-scoped:
// getPieceById + getWorkSectionsForOwner are both RLS-gated, so a writer only
// exports their own work ... a stranger's id returns null (a 404). the binary is
// streamed back with the word content-type + an attachment filename.
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

  // hoisted so the failure receipt can still name the source.
  let pieceId = "";
  let workId = "";
  try {
    const payload = (await request.json()) as { pieceId?: unknown; workId?: unknown };
    pieceId = typeof payload.pieceId === "string" ? payload.pieceId : "";
    workId = typeof payload.workId === "string" ? payload.workId : "";

    if (workId) {
      const work = await getWorkSectionsForOwner(supabase, workId);
      if (!work) {
        return NextResponse.json({ ok: false, error: "work not found" }, { status: 404 });
      }
      const buffer = await sectionsToDocx(work.title, work.sections);
      await recordExport(supabase, user.id, {
        workId,
        format: "docx",
        ok: true,
        byteSize: buffer.length,
      });
      return docxResponse(buffer, fileSlug(work.title, "work"));
    }

    if (pieceId) {
      const piece = await getPieceById(supabase, pieceId);
      if (!piece) {
        return NextResponse.json({ ok: false, error: "piece not found" }, { status: 404 });
      }
      const buffer = await slateToDocx(coercePlateValue(piece.body), piece.title);
      await recordExport(supabase, user.id, {
        pieceId,
        format: "docx",
        ok: true,
        byteSize: buffer.length,
      });
      return docxResponse(buffer, fileSlug(piece.title, "piece"));
    }

    return NextResponse.json({ ok: false, error: "which piece or work?" }, { status: 400 });
  } catch (err) {
    reportError(err, { tag: "export-docx-failed", userId: user.id });
    await recordExport(supabase, user.id, {
      workId: workId || null,
      pieceId: pieceId || null,
      format: "docx",
      ok: false,
      detail: err instanceof Error ? err.message : "export failed",
    });
    return NextResponse.json(
      { ok: false, error: "couldn't export that ... give it another go" },
      { status: 502 },
    );
  }
}
