import { NextResponse, type NextRequest } from "next/server";

import { ensureNovaUserProfile } from "@/lib/auth/ensure-user-profile";
import { sanitizeNextPath } from "@/lib/auth/sanitize-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// magic-link callback. supabase redirects here with ?code=... after the
// user clicks the link in their inbox. we exchange the code for a
// session, then make sure nova's user_profiles row exists, then send
// the user to ?next= or /library.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // ensure nova's row in the shared user_profiles. no-op if it exists
  // (lunari user signing into nova, repeat nova logins, etc.). a failure
  // here is not fatal for the session ... user is logged in regardless.
  // log so the failure is grep-able in vercel logs until sentry lands in
  // chunk 5. layout-level idempotent backfill is a deliberate follow-up.
  try {
    await ensureNovaUserProfile(data.session.user.id);
  } catch (err) {
    console.error("[ensure-profile-failed]", data.session.user.id, err);
  }

  return NextResponse.redirect(`${origin}${next ?? "/library"}`);
}
