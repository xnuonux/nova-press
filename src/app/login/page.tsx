import type { Route } from "next";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const next = sanitizeNext(params.next);

  if (user) {
    // typedRoutes wants a statically-known path; next is user input, so cast.
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
        <LoginForm next={next} />
      </div>
    </main>
  );
}

// only allow same-origin redirect targets ... no open-redirect surface.
function sanitizeNext(next: string | undefined): string | undefined {
  if (!next) return undefined;
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return undefined;
}
