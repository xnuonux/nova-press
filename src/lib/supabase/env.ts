// env validation for the shared lunari supabase substrate
// (project fpposmirumtbocqtxued). public values are NEXT_PUBLIC_ so they
// reach the browser at build time. service-role key is server-only ...
// never NEXT_PUBLIC_, never imported into client bundles.

export interface PublicSupabaseEnv {
  url: string;
  anonKey: string;
}

export interface ServiceRoleSupabaseEnv {
  url: string;
  serviceRoleKey: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing ${name} ... is .env.local set up?`);
  }
  return value;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function getServiceRoleEnv(): ServiceRoleSupabaseEnv {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
