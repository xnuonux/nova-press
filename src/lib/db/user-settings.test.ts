import { describe, expect, it, vi } from "vitest";

import { getActiveWritingFork, readActiveWritingFork, setActiveWritingFork } from "./user-settings";

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));
vi.mock("@/lib/observability/report-error", () => ({ reportError }));

type ServerClient = Parameters<typeof getActiveWritingFork>[0];

describe("readActiveWritingFork (pure narrow)", () => {
  it("pulls a non-empty string from preferences.voiceForks.activeWritingFork", () => {
    expect(readActiveWritingFork({ voiceForks: { activeWritingFork: "morning" } })).toBe("morning");
  });

  it("degrades to null for every malformed shape", () => {
    expect(readActiveWritingFork(null)).toBeNull();
    expect(readActiveWritingFork(undefined)).toBeNull();
    expect(readActiveWritingFork({})).toBeNull();
    expect(readActiveWritingFork({ voiceForks: { activeWritingFork: "" } })).toBeNull();
    expect(readActiveWritingFork({ voiceForks: { activeWritingFork: "  " } })).toBeNull();
    expect(readActiveWritingFork({ voiceForks: "oops" })).toBeNull();
    expect(readActiveWritingFork({ voiceForks: ["a"] })).toBeNull();
    expect(readActiveWritingFork(["array"])).toBeNull();
  });
});

// from().select().eq().maybeSingle() for the read; from().upsert() for the write.
function makeSettingsMock(existingPrefs: unknown = undefined, upsertError: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existingPrefs === undefined ? null : { preferences: existingPrefs },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const upsert = vi.fn().mockResolvedValue({ error: upsertError });
  const from = vi.fn().mockReturnValue({ select, upsert });
  const client = { from } as unknown as ServerClient;
  return { client, from, select, eq, maybeSingle, upsert };
}

describe("getActiveWritingFork", () => {
  it("returns the stored writing fork", async () => {
    const { client, from } = makeSettingsMock({ voiceForks: { activeWritingFork: "essay" } });
    expect(await getActiveWritingFork(client, "u1")).toBe("essay");
    expect(from).toHaveBeenCalledWith("np_user_settings");
  });

  it("returns null when there is no row", async () => {
    const { client } = makeSettingsMock(undefined);
    expect(await getActiveWritingFork(client, "u1")).toBeNull();
  });

  it("returns null on a thrown client, never throws", async () => {
    const client = {
      from: () => {
        throw new Error("down");
      },
    } as unknown as ServerClient;
    expect(await getActiveWritingFork(client, "u1")).toBeNull();
  });
});

describe("setActiveWritingFork", () => {
  it("merges ONLY voiceForks.activeWritingFork, preserving other preferences", async () => {
    const { client, upsert } = makeSettingsMock({
      typewriter_mode: true,
      default_repurpose_channels: ["newsletter"],
    });
    const r = await setActiveWritingFork(client, "u1", "Morning Voice");
    expect(r).toEqual({ ok: true });
    const [payload] = upsert.mock.calls[0] as unknown as [
      { user_id: string; preferences: Record<string, unknown> },
    ];
    expect(payload.user_id).toBe("u1");
    // other keys preserved
    expect(payload.preferences.typewriter_mode).toBe(true);
    expect(payload.preferences.default_repurpose_channels).toEqual(["newsletter"]);
    // label normalized to one canonical strand key
    expect((payload.preferences.voiceForks as Record<string, unknown>).activeWritingFork).toBe(
      "morning voice",
    );
  });

  it("clears to your voice with a null label", async () => {
    const { client, upsert } = makeSettingsMock({ voiceForks: { activeWritingFork: "morning" } });
    await setActiveWritingFork(client, "u1", null);
    const [payload] = upsert.mock.calls[0] as unknown as [{ preferences: Record<string, unknown> }];
    expect(
      (payload.preferences.voiceForks as Record<string, unknown>).activeWritingFork,
    ).toBeNull();
  });

  it("survives a non-object voiceForks in existing prefs (spread guard)", async () => {
    const { client, upsert } = makeSettingsMock({ voiceForks: "corrupt" });
    const r = await setActiveWritingFork(client, "u1", "essay");
    expect(r).toEqual({ ok: true });
    const [payload] = upsert.mock.calls[0] as unknown as [{ preferences: Record<string, unknown> }];
    expect(payload.preferences.voiceForks).toEqual({ activeWritingFork: "essay" });
  });

  it("returns { ok: false } on an upsert error, never throws", async () => {
    const { client } = makeSettingsMock({}, { message: "rls denied" });
    await expect(setActiveWritingFork(client, "u1", "morning")).resolves.toEqual({ ok: false });
  });
});
