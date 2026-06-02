import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// signout endpoint. POST-only so it can't be triggered by a stray <a>
// tag or prefetch. drops the session, redirects to /login with status
// 303 (POST -> GET redirect convention).
//
// belt-and-suspenders: explicit Origin header check against the request
// origin. modern browsers always send Origin on POST, so a missing
// Origin is a non-browser caller (lenient pass). a mismatched Origin
// is a cross-site forgery attempt (reject with 403). this locks the
// safety contract to our own code rather than relying on @supabase/ssr
// cookie SameSite defaults.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse("origin mismatch", { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${request.nextUrl.origin}/login`, {
    status: 303,
  });
}
