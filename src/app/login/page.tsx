import type { Route } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { sanitizeNextPath } from "@/lib/auth/sanitize-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Atmosphere } from "@/components/chrome/atmosphere";

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
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <Atmosphere />
      <div className="np-skyline absolute inset-x-0 top-0 h-px" aria-hidden />

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="np-rise np-rise-1 inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.34em] transition-opacity hover:opacity-80"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--nova-accent)" }}
              aria-hidden
            />
            nova press
          </Link>

          <h1
            className="np-rise np-rise-2 mt-8 font-serif text-4xl font-medium leading-tight tracking-tight"
            style={{ color: "var(--lunari-fg-primary)" }}
          >
            the writing room
          </h1>
          <p
            className="np-rise np-rise-3 mt-3 font-serif text-lg leading-relaxed"
            style={{ color: "var(--lunari-fg-muted)" }}
          >
            drop your email. we send a link, you click it, you&apos;re in.
          </p>

          <div className="np-rise np-rise-4 mt-9">
            {callbackError ? (
              <p className="mb-4 font-sans text-sm" style={{ color: "var(--nova-accent)" }}>
                {callbackError}
              </p>
            ) : null}
            <LoginForm next={next} />
          </div>

          <p
            className="np-rise np-rise-5 mt-10 font-mono text-[11px] uppercase tracking-[0.26em]"
            style={{ color: "var(--lunari-fg-subtle)" }}
          >
            no passwords. ever.
          </p>
        </div>
      </div>
    </main>
  );
}
