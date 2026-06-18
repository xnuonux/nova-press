import { NextResponse, type NextRequest } from "next/server";

import { getPublishedPieceOwner } from "@/lib/db/pieces";
import { addSubscriber } from "@/lib/db/subscribers";
import { reportError } from "@/lib/observability/report-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// public + anonymous: a reader on /p/[slug] leaves their email for the writer.
// no auth gate (the reader isn't signed in). service-role throughout: resolve
// the piece's owner by slug under the published + shareable gate, then insert
// under that owner. you can only subscribe to a real live piece ... you can't
// seed a stranger's list by guessing user ids, because the owner is derived
// from a published slug, never taken from the request.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const { slug, email } = (body ?? {}) as { slug?: unknown; email?: unknown };
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 200) {
    return NextResponse.json({ ok: false, error: "missing piece" }, { status: 400 });
  }
  if (typeof email !== "string" || email.length === 0 || email.length > 320) {
    return NextResponse.json({ ok: false, error: "that email doesn't look right" }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const owner = await getPublishedPieceOwner(admin, slug);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "this piece isn't published" }, { status: 404 });
    }
    const result = await addSubscriber(admin, {
      userId: owner.userId,
      email,
      pieceId: owner.pieceId,
      slug,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    reportError(err, { tag: "subscribe-failed", slug });
    return NextResponse.json({ ok: false, error: "couldn't save that ... try again" }, { status: 502 });
  }
}
