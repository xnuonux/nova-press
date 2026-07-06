import { NextResponse } from "next/server";

import AdmZip from "adm-zip";

import { importScrivenerProject } from "@/lib/db/scrivener-import";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { assembleScrivenerProject } from "@/lib/scrivener/project";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// a zipped .scriv project fits comfortably; a runaway upload does not.
const MAX_ZIP_BYTES = 40_000_000;
// zip-bomb discipline: only the binder xml + the rtf prose are ever
// decompressed, each entry is capped, and so is the total we inflate.
const MAX_ENTRY_BYTES = 10_000_000;
const MAX_TOTAL_BYTES = 120_000_000;
const MAX_ENTRIES = 5_000;

// import a whole scrivener project (a zip of the .scriv folder) into a new
// novel-profile Work: the binder tree becomes the node tree, each text doc's
// rtf becomes a scene's paragraphs. auth-gated + rate-limited; everything
// lands via the session client so RLS stamps the caller's own library. the
// heavy parsing is pure (src/lib/scrivener) ... this route unzips and glues.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  // a whole-project import writes a tree of rows ... a tighter budget than the
  // single-piece imports.
  const limit = rateLimit(`import-scrivener:${user.id}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "slow down a touch ... try the import again in a moment" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const declared = Number(request.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > MAX_ZIP_BYTES) {
      return NextResponse.json(
        { ok: false, error: "that project zip is a little large to import" },
        { status: 413 },
      );
    }

    const bytes = await request.arrayBuffer();
    if (bytes.byteLength === 0) {
      return NextResponse.json(
        { ok: false, error: "no file ... zip the .scriv folder and attach it" },
        { status: 400 },
      );
    }
    if (bytes.byteLength > MAX_ZIP_BYTES) {
      return NextResponse.json(
        { ok: false, error: "that project zip is a little large to import" },
        { status: 413 },
      );
    }

    const zip = new AdmZip(Buffer.from(bytes));
    const entries = zip.getEntries();
    if (entries.length > MAX_ENTRIES) {
      return NextResponse.json(
        { ok: false, error: "that zip holds too many files to be a scrivener project" },
        { status: 400 },
      );
    }

    // only the files the assembler reads are ever inflated ... research pdfs,
    // images, and anything else ride past untouched.
    const files = new Map<string, Uint8Array>();
    let total = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.replace(/\\/g, "/");
      const lower = name.toLowerCase();
      if (!lower.endsWith(".scrivx") && !lower.endsWith(".rtf")) continue;
      const size = entry.header.size;
      if (size > MAX_ENTRY_BYTES) continue;
      total += size;
      if (total > MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { ok: false, error: "that zip inflates past what an import should be" },
          { status: 400 },
        );
      }
      files.set(name, new Uint8Array(entry.getData()));
    }

    const project = assembleScrivenerProject(files);
    if (!project) {
      return NextResponse.json(
        { ok: false, error: "no scrivener binder in that zip ... zip the whole .scriv folder" },
        { status: 400 },
      );
    }

    const { workId, pages } = await importScrivenerProject(supabase, user.id, project);
    return NextResponse.json({ ok: true, workId, title: project.title, pages });
  } catch (err) {
    reportError(err, { tag: "import-scrivener-failed", userId: user.id });
    return NextResponse.json(
      { ok: false, error: "couldn't import that project ... give it another go" },
      { status: 502 },
    );
  }
}
