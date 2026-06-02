import type { Route } from "next";
import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/sanitize-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

// nova-voice copy for known callback failure codes. anything not in this
// map renders nothing (silent) ... we never echo arbitrary attacker-
// controlled error codes back to the page.
const CALLBACK_ERROR_COPY: Record<string, string> = {
  missing_code: "that link's missing something. drop your email again.",
  exchange_failed: "that link expired or got used already. drop your email for a fresh one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const next = sanitizeNextPath(params.next);
  const callbackError = params.error ? CALLBACK_ERROR_COPY[params.error] : undefined;

  if (user) {
    // typedRoutes wants a statically-known path; next has passed
    // sanitizeNextPath (same-origin only, leading slash, no backslash or
    // control bytes), so the cast is safe.
    redirect((next ?? "/library") as Route);
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl">the writing room</h1>
          <p className="text-muted-foreground text-sm">
            drop your email. we send a link, you click it, you&apos;re in.
          </p>
        </div>
        {callbackError ? <p className="text-destructive text-sm">{callbackError}</p> : null}
        <LoginForm next={next} />
      </div>
    </main>
  );
}
