import { NextResponse } from "next/server";

import type { Value } from "platejs";

import { coercePlateValue, deriveExcerpt, plateText } from "@/components/editor/plate-text";
import { createDraftPiece, savePieceContent, type PieceContentUpdate } from "@/lib/db/pieces";
import { docxToSlate } from "@/lib/io/docx";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// a 20MB cap ... a whole illustrated manuscript fits; a runaway upload does not.
// docx is a zip, so it's denser than the 2MB markdown cap.
const MAX_DOCX_BYTES = 20_000_000;

function wordCount(value: Value): number {
  return plateText(value).trim().split(/\s+/).filter(Boolean).length;
}

function firstLineTitle(value: Value): string {
  const line = plateText(value)
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return "untitled";
  return line.length > 80 ? line.slice(0, 80).trimEnd() : line;
}

// import a .docx INTO a new piece. the raw file rides the request body; mammoth
// lifts it to markdown and the existing markdown hub lands it as Slate JSON ...
// word is never stored, only the converted value. auth-gated; createDraftPiece
// stamps user_id, so the piece lands in the caller's own library.
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
    // reject on the declared size BEFORE buffering the whole body into memory ...
    // the byteLength check below is the defense-in-depth (content-length can be
    // absent or lie).
    const declared = Number(request.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > MAX_DOCX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "that file is a little large to import" },
        { status: 413 },
      );
    }

    const bytes = await request.arrayBuffer();
    if (bytes.byteLength === 0) {
      return NextResponse.json({ ok: false, error: "no file ... attach a .docx" }, { status: 400 });
    }
    if (bytes.byteLength > MAX_DOCX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "that file is a little large to import" },
        { status: 413 },
      );
    }

    const value = coercePlateValue(await docxToSlate(Buffer.from(bytes)));
    const title = firstLineTitle(value);

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
    reportError(err, { tag: "import-docx-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "couldn't import that .docx ... give it another go" },
      { status: 502 },
    );
  }
}
