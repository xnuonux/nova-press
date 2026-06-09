import { NextResponse, type NextRequest } from "next/server";

import { ensureNovaUserProfile } from "@/lib/auth/ensure-user-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// DEV ONLY ... a no-email login for local development.
//
// generates a magic token via the service role, verifies it server-side to
// set the session cookie, and drops you in /library. this sidesteps smtp
// AND the supabase redirect allowlist entirely (it never leaves the app).
//
// it is inert anywhere it matters: it 404s unless NODE_ENV is NOT
// production AND ?secret matches DEV_LOGIN_SECRET (which only ever lives in
// .env.local, never committed). two independent guards ... it cannot ship a
// working auth bypass.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const email = url.searchParams.get("email");

  if (
    process.env.NODE_ENV === "production" ||
    !process.env.DEV_LOGIN_SECRET ||
    secret !== process.env.DEV_LOGIN_SECRET
  ) {
    return new NextResponse("not found", { status: 404 });
  }
  if (!email || !email.includes("@")) {
    return new NextResponse("pass ?email=you@example.com", { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // make sure the auth user exists (idempotent ... ignores "already
  // registered"), then mint + verify a magic token for it.
  await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => {});

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link.properties?.hashed_token) {
    return new NextResponse(`could not generate link: ${linkError?.message ?? "no token"}`, {
      status: 500,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError || !verified.user) {
    return new NextResponse(`could not verify: ${verifyError?.message ?? "no user"}`, {
      status: 500,
    });
  }

  try {
    await ensureNovaUserProfile(verified.user.id);
  } catch {
    // non-fatal ... the (authed) layout backfills the profile row.
  }

  return NextResponse.redirect(`${url.origin}/library`);
}
