import { NextResponse, type NextRequest } from "next/server";

import { publishDuePieces } from "@/lib/db/scheduled";
import { reportError } from "@/lib/observability/report-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// the scheduled-publish sweep, as an internal endpoint. the pg-boss worker
// (scripts/publish-worker.mjs) ticks this once a minute; a platform cron can
// hit it just as well. all the real logic lives in the db layer so it stays
// in typescript and under test ... this route is auth + glue.
//
// INERT unless configured: it 404s when NOVA_WORKER_SECRET is unset or the
// x-nova-worker-secret header doesn't match (the dev-login guard pattern ...
// it cannot ship an open admin endpoint). the sweep runs on the service role:
// the writer is asleep, that's the point of scheduling.
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-nova-worker-secret");
  if (!process.env.NOVA_WORKER_SECRET || secret !== process.env.NOVA_WORKER_SECRET) {
    return new NextResponse("not found", { status: 404 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const result = await publishDuePieces(admin, new Date().toISOString());
    if (result.error) {
      reportError(new Error(result.error), { tag: "publish-due-sweep" });
      return NextResponse.json({ ok: false, error: "the sweep read failed" }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      published: result.published.length,
      reverted: result.reverted.length,
    });
  } catch (err) {
    reportError(err, { tag: "publish-due-sweep" });
    return NextResponse.json({ ok: false, error: "the sweep failed" }, { status: 502 });
  }
}
