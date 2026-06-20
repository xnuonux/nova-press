import { describe, expect, it, vi } from "vitest";

import type { ExtractedVoice } from "@/lib/ai/voice-extract";

import {
  extractedVoiceToSnapshot,
  insertVoiceSnapshot,
  listVoiceSnapshots,
} from "./voice-snapshots";

// hoisted so the vi.mock factory can reference it (vitest hoists vi.mock above
// imports; a plain const would be in the temporal dead zone at factory time).
const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));
vi.mock("@/lib/observability/report-error", () => ({ reportError }));

type ServerClient = Parameters<typeof insertVoiceSnapshot>[0];

const SAMPLE_EXTRACT: ExtractedVoice = {
  register: "wry",
  vocabulary_signature: "spare",
  opening_patterns: ["so,"],
  closing_patterns: ["and that's that."],
  idiosyncratic_phrases: ["here's the thing"],
  avoided_phrases: ["at the end of the day"],
  formality_score: 0.3,
  summary: "short and punchy",
  exemplars: ["a line."],
  confidence: 0.7,
  stats: {
    sentence_length_avg: 9.6,
    sentence_length_variance: 2.4,
    paragraph_length_avg: 30.2,
    paragraph_length_variance: 5.1,
    punctuation_style: { comma: 40 },
    emoji_signature: { count: 0, per_1000_words: 0 },
  },
  model: "deepseek-chat",
  samples_count: 4,
};

describe("extractedVoiceToSnapshot", () => {
  it("maps a distilled voice into the denormalized snapshot payload", () => {
    const out = extractedVoiceToSnapshot("user-1", SAMPLE_EXTRACT, "2026-06-19T10:00:00.000Z");
    expect(out.user_id).toBe("user-1");
    expect(out.captured_at).toBe("2026-06-19T10:00:00.000Z");
    expect(out.source).toBe("extraction");
    expect(out.fork_label).toBeNull();
    // the _avg fields round to int (integer columns); variance stays numeric.
    expect(out.sentence_length_avg).toBe(10);
    expect(out.sentence_length_variance).toBe(2.4);
    expect(out.paragraph_length_avg).toBe(30);
    expect(out.paragraph_length_variance).toBe(5.1);
    expect(out.formality_score).toBe(0.3);
    // jsonb blobs frozen verbatim.
    expect(out.punctuation_style).toEqual({ comma: 40 });
    expect(out.idiosyncratic_phrases).toEqual(["here's the thing"]);
    expect(out.opening_patterns).toEqual(["so,"]);
    expect(out.register).toBe("wry");
    expect(out.summary).toBe("short and punchy");
    // provenance copied.
    expect(out.extraction_model).toBe("deepseek-chat");
    expect(out.extraction_confidence).toBe(0.7);
    expect(out.samples_count).toBe(4);
  });

  it("never emits gen connect's outreach_* columns or row-housekeeping keys", () => {
    const out = extractedVoiceToSnapshot("user-1", SAMPLE_EXTRACT, "2026-06-19T10:00:00.000Z");
    // the snapshot is fed by nova's ExtractedVoice, so gen connect's columns are
    // physically out of scope ... assert the payload can't carry them.
    expect(out).not.toHaveProperty("outreach_overrides");
    expect(out).not.toHaveProperty("outreach_samples_count");
    expect(out).not.toHaveProperty("active_for_outreach");
    // created_at / updated_at are left to the column defaults, never written.
    expect(out).not.toHaveProperty("created_at");
    expect(out).not.toHaveProperty("updated_at");
  });

  it("rounds a null avg to null and defaults a missing model", () => {
    const v: ExtractedVoice = {
      ...SAMPLE_EXTRACT,
      model: null as unknown as string,
      stats: { ...SAMPLE_EXTRACT.stats, sentence_length_avg: null },
    };
    const out = extractedVoiceToSnapshot("user-1", v, "t");
    expect(out.sentence_length_avg).toBeNull();
    expect(out.extraction_model).toBe("unknown");
  });
});

function makeInsertMock(error: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ insert });
  const client = { from } as unknown as ServerClient;
  return { client, from, insert };
}

describe("insertVoiceSnapshot", () => {
  it("inserts the snapshot payload on np_voice_snapshots", async () => {
    const { client, from, insert } = makeInsertMock();
    await insertVoiceSnapshot(client, "user-1", SAMPLE_EXTRACT, "2026-06-19T10:00:00.000Z");
    expect(from).toHaveBeenCalledWith("np_voice_snapshots");
    const [payload] = insert.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(payload.user_id).toBe("user-1");
    expect(payload.source).toBe("extraction");
    expect(payload.captured_at).toBe("2026-06-19T10:00:00.000Z");
  });

  it("never throws on an insert error ... a snapshot failure can't 502 the train", async () => {
    reportError.mockClear();
    const { client } = makeInsertMock({ message: "boom" });
    await expect(
      insertVoiceSnapshot(client, "user-1", SAMPLE_EXTRACT, "t"),
    ).resolves.toBeUndefined();
    expect(reportError).toHaveBeenCalled();
  });

  it("swallows a thrown client (offline) without rejecting", async () => {
    const client = {
      from: () => {
        throw new Error("down");
      },
    } as unknown as ServerClient;
    await expect(
      insertVoiceSnapshot(client, "user-1", SAMPLE_EXTRACT, "t"),
    ).resolves.toBeUndefined();
  });
});

// from().select().eq().order().limit() -> { data, error }
function makeListMock(data: unknown, error: unknown = null) {
  const limit = vi.fn().mockResolvedValue({ data, error });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const client = { from } as unknown as ServerClient;
  return { client, from, select, eq, order, limit };
}

describe("listVoiceSnapshots", () => {
  it("reads the caller's snapshots newest-first, narrowing each row", async () => {
    const row = {
      id: "s1",
      captured_at: "2026-06-19T10:00:00.000Z",
      source: "extraction",
      fork_label: null,
      sentence_length_avg: 10,
      sentence_length_variance: 2,
      paragraph_length_avg: 30,
      formality_score: 0.3,
      // a malformed historical row: a non-number value + a non-string in an
      // array. the read layer must narrow these, not choke.
      punctuation_style: { comma: 40, junk: "nope" },
      emoji_signature: { count: 0, per_1000_words: 0 },
      register: "wry",
      vocabulary_signature: "spare",
      opening_patterns: ["so,", 5],
      closing_patterns: [],
      idiosyncratic_phrases: ["here's the thing"],
      avoided_phrases: [],
      summary: "short and punchy",
      extraction_model: "deepseek-chat",
      extraction_confidence: 0.7,
      samples_count: 4,
    };
    const { client, from, eq, order, limit } = makeListMock([row]);
    const out = await listVoiceSnapshots(client, "user-1", 30);
    expect(from).toHaveBeenCalledWith("np_voice_snapshots");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(order).toHaveBeenCalledWith("captured_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(30);
    expect(out).toHaveLength(1);
    expect(out[0]?.capturedAt).toBe("2026-06-19T10:00:00.000Z");
    expect(out[0]?.register).toBe("wry");
    // malformed jsonb narrowed: the non-string array entry + non-number value drop.
    expect(out[0]?.openingPatterns).toEqual(["so,"]);
    expect(out[0]?.punctuationStyle).toEqual({ comma: 40 });
  });

  it("returns [] on a read error", async () => {
    const { client } = makeListMock(null, { message: "rls denied" });
    expect(await listVoiceSnapshots(client, "user-1")).toEqual([]);
  });

  it("returns [] when a thrown client blows up the read", async () => {
    const client = {
      from: () => {
        throw new Error("down");
      },
    } as unknown as ServerClient;
    expect(await listVoiceSnapshots(client, "user-1")).toEqual([]);
  });
});
