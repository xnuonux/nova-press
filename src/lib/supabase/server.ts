import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/supabase";

import { getPublicSupabaseEnv } from "./env";

export type SupabaseServerClient = ReturnType<typeof createServerClient<Database>>;

type CookieToSet = { name: string; value: string; options: CookieOptions };

// server-side supabase client for RSC, server actions, and route handlers.
// honors RLS via the user's session cookie. async because next 15's
// cookies() is async.
export async function createSupabaseServerClient(): Promise<SupabaseServerClient> {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll throws in server components since cookies() is
          // read-only there. middleware refreshes the session on every
          // request anyway, so this is safe to swallow.
        }
      },
    },
  });
}
