import { describe, expect, it, vi } from "vitest";

import { ensureNovaUserProfile } from "./ensure-user-profile";

type AdminClientArg = Parameters<typeof ensureNovaUserProfile>[1];

function makeMockClient(overrides?: { upsertError?: unknown }) {
  const upsert = vi.fn().mockResolvedValue({ error: overrides?.upsertError ?? null });
  const from = vi.fn().mockReturnValue({ upsert });
  return {
    client: { from } as unknown as NonNullable<AdminClientArg>,
    upsert,
    from,
  };
}

describe("ensureNovaUserProfile", () => {
  it("targets the user_profiles table", async () => {
    const { client, from } = makeMockClient();
    await ensureNovaUserProfile("user-uuid", client);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("user_profiles");
  });

  it("writes only nova's three columns ... never touches other surfaces", async () => {
    const { client, upsert } = makeMockClient();
    await ensureNovaUserProfile("user-uuid", client);
    expect(upsert).toHaveBeenCalledTimes(1);
    const firstCall = upsert.mock.calls[0]!;
    const payload = firstCall[0];
    expect(payload).toEqual({
      user_id: "user-uuid",
      is_nova_press_only: true,
      signup_surface: "nova_press",
    });
    // explicit guard: no leaked keys ... is_lunari_user, is_gen_connect_only,
    // is_lunari_company, etc. must NEVER appear here
    expect(Object.keys(payload).sort()).toEqual([
      "is_nova_press_only",
      "signup_surface",
      "user_id",
    ]);
  });

  it("uses ignoreDuplicates so existing rows (e.g. lunari users) are not overwritten", async () => {
    const { client, upsert } = makeMockClient();
    await ensureNovaUserProfile("user-uuid", client);
    const firstCall = upsert.mock.calls[0]!;
    const options = firstCall[1];
    expect(options).toEqual({
      onConflict: "user_id",
      ignoreDuplicates: true,
    });
  });

  it("resolves silently on success", async () => {
    const { client } = makeMockClient();
    await expect(ensureNovaUserProfile("user-uuid", client)).resolves.toBeUndefined();
  });

  it("throws when the client returns an error", async () => {
    const { client } = makeMockClient({
      upsertError: { message: "db is sad" },
    });
    await expect(ensureNovaUserProfile("user-uuid", client)).rejects.toThrow(/db is sad/);
  });
});
