import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

import { getServiceRoleEnv } from "./env";

// service-role supabase client. bypasses RLS. server-only, never browser.
// callers: signup callback (user_profiles INSERT), /p/[slug] reading view,
// pg-boss workers, anything that needs to write across RLS boundaries.
export function createSupabaseAdminClient(): SupabaseClient<Database> {
  if (typeof window !== "undefined") {
    throw new Error(
      "createSupabaseAdminClient cannot run in the browser ... service role bypasses RLS and must stay server-side",
    );
  }
  const { url, serviceRoleKey } = getServiceRoleEnv();
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
