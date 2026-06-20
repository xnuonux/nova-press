import { NextResponse, type NextRequest } from "next/server";

import { isUuid, unsubscribeByToken } from "@/lib/db/subscribers";
import { terminalPage } from "@/lib/email/messages";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// anonymous + service-role. the reader clicks the unsubscribe link printed in a
// newsletter footer; the STABLE unsubscribe token (never the confirm token)
// drops them off the list. idempotent, rate-limited per ip, uuid-validated
// before any db round-trip.
const UNSUB_LIMIT = 12;
const UNSUB_WINDOW_MS = 60_000;

// ONE page for every outcome (unsubscribed / already / unknown token).
const PAGE = terminalPage(
  "you're unsubscribed",
  "done ... you won't get any more of these. no hard feelings, the door stays open.",
);

function page(status = 200): NextResponse {
  return new NextResponse(PAGE, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(`unsub:${clientIp(request)}`, UNSUB_LIMIT, UNSUB_WINDOW_MS);
  if (!limited.allowed) {
    return new NextResponse("slow down a sec ... try again in a moment", {
      status: 429,
      headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000)) },
    });
  }

  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!isUuid(token)) return page();

  try {
    const admin = createSupabaseAdminClient();
    await unsubscribeByToken(admin, token);
  } catch (err) {
    reportError(err, { tag: "unsubscribe-failed" });
  }
  return page();
}
