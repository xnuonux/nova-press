import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/supabase";

import { getPublicSupabaseEnv } from "./env";

// inferred return type ... @supabase/ssr's createBrowserClient returns a
// supabase client typed against an older internal generic shape than
// @supabase/supabase-js v2.106. using ReturnType keeps the factory and
// memo in lockstep without a type assertion.
export type SupabaseBrowserClient = ReturnType<typeof createBrowserClient<Database>>;

// browser-side supabase client. memoized at module scope so we don't
// instantiate twice and race the auth state.
let _client: SupabaseBrowserClient | undefined;

export function createSupabaseBrowserClient(): SupabaseBrowserClient {
  if (_client) return _client;
  const { url, anonKey } = getPublicSupabaseEnv();
  _client = createBrowserClient<Database>(url, anonKey);
  return _client;
}
