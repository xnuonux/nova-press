import { describe, expect, it, vi } from "vitest";

import type { ExtractedVoice } from "@/lib/ai/voice-extract";

import { getWriterVoice, saveWriterVoice } from "./voice-profile";

// saveWriterVoice now also captures a longitudinal snapshot; both it and the
// snapshot module report errors here. mock it (hoisted, so the factory can see
// it) to keep the suite quiet and out of sentry.
const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));
vi.mock("@/lib/observability/report-error", () => ({ reportError }));

type ServerClient = Parameters<typeof getWriterVoice>[0];

// from().select().eq().maybeSingle() -> { data, error }
function makeReadMock(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const client = { from } as unknown as ServerClient;
  return { client, from, select, eq, maybeSingle };
}

// saveWriterVoice reads extraction_history (from().select().eq().maybeSingle())
// then writes voice_profiles (from().upsert()), then captures a snapshot
// (from('np_voice_snapshots').insert()). from() branches on the table so the
// snapshot insert is distinguishable from the profile upsert.
function makeUpsertMock(error: unknown = null, priorHistory: unknown[] | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: priorHistory === null ? null : { extraction_history: priorHistory },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const upsert = vi.fn().mockResolvedValue({ error });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) =>
    table === "np_voice_snapshots" ? { insert } : { select, upsert },
  );
  const client = { from } as unknown as ServerClient;
  return { client, from, upsert, insert };
}

describe("getWriterVoice", () => {
  it("returns the compact view + exemplars from the profile", async () => {
    const { client, from, eq } = makeReadMock({
      register: "casual and direct",
      writing_overrides: { exemplars: ["the room waited.", "then it glowed."] },
    });
    const out = await getWriterVoice(client, "user-1");
    expect(from).toHaveBeenCalledWith("voice_profiles");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(out.voiceCompactView).toBe("register: casual and direct");
    expect(out.exemplars).toEqual(["the room waited.", "then it glowed."]);
  });

  it("returns {} when there's no row", async () => {
    const { client } = makeReadMock(null);
    expect(await getWriterVoice(client, "user-1")).toEqual({});
  });

  it("returns {} on a read error ... a voice read never fails a generation", async () => {
    const { client } = makeReadMock(null, { message: "rls denied" });
    expect(await getWriterVoice(client, "user-1")).toEqual({});
  });

  it("returns {} when mirroring is turned off", async () => {
    const { client } = makeReadMock({ register: "x", active_for_writing: false });
    expect(await getWriterVoice(client, "user-1")).toEqual({});
  });

  it("omits exemplars when there are none", async () => {
    const { client } = makeReadMock({ register: "casual" });
    const out = await getWriterVoice(client, "user-1");
    expect(out.voiceCompactView).toBe("register: casual");
    expect(out.exemplars).toBeUndefined();
  });
});

const SAMPLE_EXTRACT: ExtractedVoice = {
  register: "wry",
  vocabulary_signature: "spare",
  opening_patterns: [],
  closing_patterns: [],
  idiosyncratic_phrases: ["here's the thing"],
  avoided_phrases: [],
  formality_score: 0.3,
  summary: "short and punchy",
  exemplars: ["a line."],
  confidence: 0.7,
  stats: {
    sentence_length_avg: 9,
    sentence_length_variance: 2,
    paragraph_length_avg: 30,
    paragraph_length_variance: 5,
    punctuation_style: { comma: 40 },
    emoji_signature: { count: 0, per_1000_words: 0 },
  },
  model: "deepseek-chat",
  samples_count: 4,
};

describe("saveWriterVoice", () => {
  it("upserts nova's columns on user_id, summary + exemplars in writing_overrides", async () => {
    const { client, from, upsert } = makeUpsertMock();
    await saveWriterVoice(client, "user-1", SAMPLE_EXTRACT);
    expect(from).toHaveBeenCalledWith("voice_profiles");
    const [payload, opts] = upsert.mock.calls[0] as unknown as [Record<string, unknown>, unknown];
    expect(payload.user_id).toBe("user-1");
    expect(payload.register).toBe("wry");
    expect(payload.sentence_length_avg).toBe(9);
    expect(payload.active_for_writing).toBe(true);
    expect(payload.last_extracted_by).toBe("nova_press");
    expect(payload.writing_overrides).toEqual({
      summary: "short and punchy",
      exemplars: ["a line."],
    });
    expect(opts).toEqual({ onConflict: "user_id" });
    // appends one extraction_history entry (no prior history)
    expect(Array.isArray(payload.extraction_history)).toBe(true);
    expect((payload.extraction_history as unknown[]).length).toBe(1);
    // never writes gen connect's columns
    expect(payload).not.toHaveProperty("outreach_overrides");
    expect(payload).not.toHaveProperty("active_for_outreach");
  });

  it("appends to extraction_history and trims to the last 5", async () => {
    const prior = [1, 2, 3, 4, 5].map((n) => ({ at: `t${n}`, by: "nova_press" }));
    const { client, upsert } = makeUpsertMock(null, prior);
    await saveWriterVoice(client, "user-1", SAMPLE_EXTRACT);
    const [payload] = upsert.mock.calls[0] as unknown as [Record<string, unknown>, unknown];
    const history = payload.extraction_history as Array<{ at: string; by: string }>;
    expect(history).toHaveLength(5);
    // the oldest entry is dropped, the newest is nova's
    expect(history[0]?.at).toBe("t2");
    expect(history[4]?.by).toBe("nova_press");
  });

  it("throws on a db error", async () => {
    const { client } = makeUpsertMock({ message: "boom" });
    await expect(saveWriterVoice(client, "user-1", SAMPLE_EXTRACT)).rejects.toThrow(/boom/);
  });

  it("captures a longitudinal snapshot after the upsert succeeds", async () => {
    const { client, from, insert } = makeUpsertMock();
    await saveWriterVoice(client, "user-1", SAMPLE_EXTRACT);
    expect(from).toHaveBeenCalledWith("np_voice_snapshots");
    expect(insert).toHaveBeenCalledTimes(1);
    const [payload] = insert.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(payload.user_id).toBe("user-1");
    expect(payload.source).toBe("extraction");
  });

  it("stamps the snapshot's captured_at with the same nowIso as last_extracted_at", async () => {
    const { client, upsert, insert } = makeUpsertMock();
    await saveWriterVoice(client, "user-1", SAMPLE_EXTRACT);
    const [profile] = upsert.mock.calls[0] as unknown as [Record<string, unknown>];
    const [snapshot] = insert.mock.calls[0] as unknown as [Record<string, unknown>];
    // the dot and the live row agree to the second.
    expect(snapshot.captured_at).toBe(profile.last_extracted_at);
  });

  it("a snapshot-capture failure does NOT fail saveWriterVoice (never a 502 on train)", async () => {
    const { client, insert } = makeUpsertMock();
    insert.mockRejectedValueOnce(new Error("snapshot down"));
    await expect(saveWriterVoice(client, "user-1", SAMPLE_EXTRACT)).resolves.toBeUndefined();
  });
});
