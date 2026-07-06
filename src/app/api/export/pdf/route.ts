import { NextResponse } from "next/server";

import { coercePlateValue } from "@/components/editor/plate-text";
import { getWorkSectionsForOwner } from "@/lib/db/works";
import { fileSlug } from "@/lib/io/filename";
import { slateToHtml } from "@/lib/io/html";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { composeBookHtml, type TypesetSection } from "@/lib/typeset/book";
import { renderBookPdf, TypesetUnavailableError } from "@/lib/typeset/pdf";

const PDF_MIME = "application/pdf";

// a whole book of html is fine; past this the paged layout would hold a
// browser open for minutes ... refuse honestly instead of timing out.
const MAX_BOOK_HTML_CHARS = 3_000_000;

// the typeset render holds a headless browser while pagedjs breaks the book
// into pages ... on serverless this needs more than the default window.
export const maxDuration = 120;

// typeset a whole Work into a print-grade pdf: the reading sections serialize
// to safe html, the pure book assembly dresses them in front/back matter and
// the print typography pass, and headless chromium + pagedjs set the pages.
// owner-scoped (getWorkSectionsForOwner is RLS-gated). the heaviest export we
// run, so it gets the tightest rate budget.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  const limit = rateLimit(`export-pdf:${user.id}`, 3, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "the typesetter is still warm ... try again in a moment" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const payload = (await request.json()) as { workId?: unknown };
    const workId = typeof payload.workId === "string" ? payload.workId : "";
    if (!workId) {
      return NextResponse.json({ ok: false, error: "which work?" }, { status: 400 });
    }

    const work = await getWorkSectionsForOwner(supabase, workId);
    if (!work) {
      return NextResponse.json({ ok: false, error: "work not found" }, { status: 404 });
    }

    const sections: TypesetSection[] = work.sections.map((s) => ({
      title: s.title,
      depth: s.depth,
      isLeaf: s.isLeaf,
      html: s.isLeaf ? slateToHtml(coercePlateValue(s.body)) : "",
    }));

    const html = composeBookHtml({
      title: work.title,
      formProfile: work.formProfile,
      year: new Date().getFullYear(),
      sections,
    });
    if (html.length > MAX_BOOK_HTML_CHARS) {
      return NextResponse.json(
        { ok: false, error: "that book is past what the typesetter can set in one go" },
        { status: 413 },
      );
    }

    const buffer = await renderBookPdf(html);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": PDF_MIME,
        "content-disposition": `attachment; filename="${fileSlug(work.title, "work")}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof TypesetUnavailableError) {
      // no chromium on this host ... an honest 503, not a crash. the writer's
      // words are untouched; the typesetter just isn't home.
      return NextResponse.json(
        { ok: false, error: "the typesetter isn't available on this host yet" },
        { status: 503 },
      );
    }
    reportError(err, { tag: "export-pdf-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "couldn't set those pages ... give it another go" },
      { status: 502 },
    );
  }
}
