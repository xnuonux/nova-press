import { NextResponse } from "next/server";

import { coercePlateValue } from "@/components/editor/plate-text";
import { recordExport } from "@/lib/db/exports";
import { getWorkSectionsForOwner } from "@/lib/db/works";
import { epubChaptersFromSections, workToEpub, type EpubSection } from "@/lib/io/epub";
import { fileSlug } from "@/lib/io/filename";
import { slateToHtml } from "@/lib/io/html";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EPUB_MIME = "application/epub+zip";

// export a whole Work OUT of Slate JSON as a real .epub: each leaf becomes a
// chapter (titled by its breadcrumb path), its body serialized to safe html.
// owner-scoped (getWorkSectionsForOwner is RLS-gated). epub rendering touches a
// temp dir + a heavy lib, so it gets its own tighter rate-limit budget.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  // epub is heavier than markdown/docx ... a tighter budget keeps a mashed button
  // from spawning a pile of temp renders.
  const limit = rateLimit(`export-epub:${user.id}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "slow down a touch ... try the epub again in a moment" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  // hoisted so the failure receipt can still name the work.
  let workId = "";
  try {
    const payload = (await request.json()) as { workId?: unknown };
    workId = typeof payload.workId === "string" ? payload.workId : "";
    if (!workId) {
      return NextResponse.json({ ok: false, error: "which work?" }, { status: 400 });
    }

    const work = await getWorkSectionsForOwner(supabase, workId);
    if (!work) {
      return NextResponse.json({ ok: false, error: "work not found" }, { status: 404 });
    }

    const epubSections: EpubSection[] = work.sections.map((s) => ({
      title: s.title,
      depth: s.depth,
      isLeaf: s.isLeaf,
      html: s.isLeaf ? slateToHtml(coercePlateValue(s.body)) : "",
    }));
    const chapters = epubChaptersFromSections(epubSections);
    const buffer = await workToEpub(work.title, chapters);
    await recordExport(supabase, user.id, {
      workId,
      format: "epub",
      ok: true,
      byteSize: buffer.length,
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": EPUB_MIME,
        "content-disposition": `attachment; filename="${fileSlug(work.title, "work")}.epub"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    reportError(err, { tag: "export-epub-failed", userId: user.id });
    await recordExport(supabase, user.id, {
      workId: workId || null,
      format: "epub",
      ok: false,
      detail: err instanceof Error ? err.message : "export failed",
    });
    return NextResponse.json(
      { ok: false, error: "couldn't build that epub ... give it another go" },
      { status: 502 },
    );
  }
}
