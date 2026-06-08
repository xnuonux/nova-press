import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ensureNovaUserProfile } from "@/lib/auth/ensure-user-profile";
import { reportError } from "@/lib/observability/report-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// authenticated route group. every page inside this group is gated by a
// supabase session. additionally, every render triggers an idempotent
// ensureNovaUserProfile upsert (ignoreDuplicates makes it cheap on the
// hot path). this closes the silent-swallow loophole the substrate
// audit caught: users whose initial /auth/callback ensureProfile threw
// and was swallowed get their user_profiles row backfilled here on the
// next authenticated page render.
export default async function AuthedLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    await ensureNovaUserProfile(user.id);
  } catch (err) {
    // reported, never blocks the page render ... a missing user_profiles
    // row is recoverable (next render retries the upsert), so users still
    // see their library / editor while ops gets paged via sentry.
    reportError(err, {
      tag: "layout-ensure-profile-failed",
      userId: user.id,
      surface: "authed-layout",
    });
  }

  return <>{children}</>;
}
