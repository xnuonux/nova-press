import { NextResponse, type NextRequest } from "next/server";

import { confirmSubscriber, isUuid } from "@/lib/db/subscribers";
import { terminalPage } from "@/lib/email/messages";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// anonymous + service-role. the reader clicks the link in their confirm email;
// the single-use token flips a 'pending' row to confirmed. rate-limited per ip,
// and the token is validated as a uuid BEFORE any db round-trip so a scripted
// loop of junk tokens never reaches the database.
const CONFIRM_LIMIT = 12;
const CONFIRM_WINDOW_MS = 60_000;

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  const first = fwd ? fwd.split(",")[0]?.trim() : "";
  return first || request.headers.get("x-real-ip") || "unknown";
}

// ONE page for every outcome (confirmed / already / unknown token), so the
// landing can never be read as an oracle for token validity or list membership.
const PAGE = terminalPage(
  "you're in",
  "confirmed ... thanks for the trust. the next piece will land in your inbox.",
);

function page(status = 200): NextResponse {
  return new NextResponse(PAGE, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(`confirm:${clientIp(request)}`, CONFIRM_LIMIT, CONFIRM_WINDOW_MS);
  if (!limited.allowed) {
    return new NextResponse("slow down a sec ... try again in a moment", {
      status: 429,
      headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000)) },
    });
  }

  const token = request.nextUrl.searchParams.get("token") ?? "";
  // malformed token: same page, no db hit.
  if (!isUuid(token)) return page();

  try {
    const admin = createSupabaseAdminClient();
    await confirmSubscriber(admin, token);
  } catch (err) {
    reportError(err, { tag: "confirm-failed" });
  }
  return page();
}
