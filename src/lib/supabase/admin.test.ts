import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseAdminClient } from "./admin";

describe("createSupabaseAdminClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns a client with the expected supabase shape", () => {
    const client = createSupabaseAdminClient();
    expect(typeof client.from).toBe("function");
    expect(typeof client.auth.admin).toBe("object");
  });

  it("throws if called from a browser context", () => {
    vi.stubGlobal("window", {});
    expect(() => createSupabaseAdminClient()).toThrow(/browser/i);
  });

  it("throws if SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => createSupabaseAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
