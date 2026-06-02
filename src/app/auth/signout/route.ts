import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// signout endpoint. POST-only so it can't be triggered by a stray <a> tag
// or prefetch. drops the session, redirects to /login with status 303
// (POST -> GET redirect convention).
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
