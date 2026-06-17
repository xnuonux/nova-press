import { describe, expect, it, vi } from "vitest";

import { getWriterVoice } from "./voice-profile";

type ServerClient = Parameters<typeof getWriterVoice>[0];

// from().select().eq().maybeSingle() -> { data, error }
function makeVoiceMock(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const client = { from } as unknown as ServerClient;
  return { client, from, select, eq, maybeSingle };
}

describe("getWriterVoice", () => {
  it("reads voice_profiles for the user and returns the compact view", async () => {
    const { client, from, eq } = makeVoiceMock({ register: "casual and direct" });
    const out = await getWriterVoice(client, "user-1");
    expect(from).toHaveBeenCalledWith("voice_profiles");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(out).toBe("register: casual and direct");
  });

  it("returns undefined when there's no row", async () => {
    const { client } = makeVoiceMock(null);
    expect(await getWriterVoice(client, "user-1")).toBeUndefined();
  });

  it("returns undefined on a read error ... a voice read never fails a generation", async () => {
    const { client } = makeVoiceMock(null, { message: "rls denied" });
    expect(await getWriterVoice(client, "user-1")).toBeUndefined();
  });

  it("returns undefined when the row has nothing renderable", async () => {
    const { client } = makeVoiceMock({ register: null, vocabulary_signature: null });
    expect(await getWriterVoice(client, "user-1")).toBeUndefined();
  });
});
