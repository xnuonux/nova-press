import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseBrowserClient } from "./client";

describe("createSupabaseBrowserClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  it("returns a client with the expected supabase shape", () => {
    const client = createSupabaseBrowserClient();
    expect(typeof client.from).toBe("function");
    expect(typeof client.auth.signInWithOtp).toBe("function");
    expect(typeof client.auth.signOut).toBe("function");
  });

  it("memoizes ... returns the same instance on repeated calls", () => {
    const a = createSupabaseBrowserClient();
    const b = createSupabaseBrowserClient();
    expect(a).toBe(b);
  });
});
