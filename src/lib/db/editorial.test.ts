import { describe, it, expect, vi } from "vitest";

import { rowToPass, upsertPass, listPassesForPiece, deriveWorkStage, setStage } from "./editorial";

type ServerClient = Parameters<typeof listPassesForPiece>[0];

const sampleRow = {
  id: "pass-1",
  user_id: "user-1",
  piece_id: "piece-1",
  stage: "line",
  findings: [{ lens: "mechanical", message: "x", severity: "flag", scope: {}, status: "open" }],
  lens_keys: ["mechanical", "readability"],
  source_edited_at: "2026-06-01T00:00:00Z",
  pass_metadata: { model: "deepseek" },
  generated_at: "2026-06-01T00:00:01Z",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:02Z",
};

describe("rowToPass maps the np_editorial_passes row to the domain", () => {
  it("camelCases the columns + coerces the jsonb / arrays", () => {
    expect(rowToPass(sampleRow as never)).toEqual({
      id: "pass-1",
      userId: "user-1",
      pieceId: "piece-1",
      stage: "line",
      findings: sampleRow.findings,
      lensKeys: ["mechanical", "readability"],
      sourceEditedAt: "2026-06-01T00:00:00Z",
      passMetadata: { model: "deepseek" },
      generatedAt: "2026-06-01T00:00:01Z",
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:02Z",
    });
  });

  it("a corrupt stage / non-array findings degrade safely", () => {
    const r = rowToPass({ ...sampleRow, stage: "bogus", findings: null, lens_keys: null } as never);
    expect(r.stage).toBe("drafting");
    expect(r.findings).toEqual([]);
    expect(r.lensKeys).toEqual([]);
  });
});

describe("upsertPass writes one row per (piece, stage)", () => {
  it("upserts on the piece_id,stage conflict with the pass payload", async () => {
    const single = vi.fn().mockResolvedValue({ data: sampleRow, error: null });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ upsert }));
    const client = { from } as unknown as ServerClient;

    const out = await upsertPass(client, "user-1", {
      pieceId: "piece-1",
      stage: "line",
      findings: sampleRow.findings as never,
      lensKeys: ["mechanical"],
      sourceEditedAt: "2026-06-01T00:00:00Z",
    });

    expect(from).toHaveBeenCalledWith("np_editorial_passes");
    const [payload, opts] = upsert.mock.calls[0] as unknown as [Record<string, unknown>, unknown];
    expect(payload).toMatchObject({
      user_id: "user-1",
      piece_id: "piece-1",
      stage: "line",
      lens_keys: ["mechanical"],
      source_edited_at: "2026-06-01T00:00:00Z",
    });
    expect(opts).toEqual({ onConflict: "piece_id,stage" });
    expect(out.id).toBe("pass-1");
  });
});

describe("listPassesForPiece scopes to the piece", () => {
  it("queries np_editorial_passes by piece_id", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [sampleRow], error: null });
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as unknown as ServerClient;

    const out = await listPassesForPiece(client, "piece-1");
    expect(eq).toHaveBeenCalledWith("piece_id", "piece-1");
    expect(out).toHaveLength(1);
    expect(out[0]!.stage).toBe("line");
  });
});

describe("deriveWorkStage is the min over the work's pieces", () => {
  it("returns the least-finished stage", async () => {
    const eq = vi
      .fn()
      .mockResolvedValue({
        data: [{ editorial_stage: "proof" }, { editorial_stage: "line" }],
        error: null,
      });
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as unknown as ServerClient;

    await expect(deriveWorkStage(client, "work-1")).resolves.toBe("line");
  });
});

// setStage reads the piece, (for an advance) the gating pass, then maybe writes.
// the mock dispatches by table: np_pieces serves the select + the update,
// np_editorial_passes serves the gating-pass read.
function makeSetStageMock(piece: unknown, pass: unknown) {
  const updateCalls: { payload: Record<string, unknown> }[] = [];
  const from = vi.fn((table: string) => {
    if (table === "np_pieces") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: piece, error: null }) }) }),
        update: (payload: Record<string, unknown>) => ({
          eq: async () => {
            updateCalls.push({ payload });
            return { error: null };
          },
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: pass, error: null }) }) }),
      }),
    };
  });
  return { client: { from } as unknown as ServerClient, updateCalls };
}

describe("setStage moves a piece through the gate", () => {
  it("an advance with a clear, current pass writes the stage + logs the history", async () => {
    const piece = {
      editorial_stage: "drafting",
      last_edited_at: "2026-06-01T00:00:00Z",
      metadata: {},
    };
    const clearPass = {
      ...sampleRow,
      stage: "drafting",
      findings: [{ lens: "x", message: "n", severity: "note", scope: {}, status: "open" }],
      source_edited_at: "2026-06-02T00:00:00Z", // after last_edited_at -> not stale
    };
    const { client, updateCalls } = makeSetStageMock(piece, clearPass);

    const result = await setStage(client, "piece-1", "developmental");
    expect(result.allowed).toBe(true);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]!.payload.editorial_stage).toBe("developmental");
    const meta = updateCalls[0]!.payload.metadata as { editorial: { history: unknown[] } };
    expect(meta.editorial.history).toEqual([
      { at: expect.any(String), from: "drafting", to: "developmental" },
    ]);
  });

  it("an advance with no pass is blocked and writes nothing", async () => {
    const piece = {
      editorial_stage: "drafting",
      last_edited_at: "2026-06-01T00:00:00Z",
      metadata: {},
    };
    const { client, updateCalls } = makeSetStageMock(piece, null);

    const result = await setStage(client, "piece-1", "developmental");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("hasn't been reviewed");
    expect(updateCalls).toHaveLength(0);
  });

  it("a retreat is free and writes the stage with no pass needed", async () => {
    const piece = {
      editorial_stage: "proof",
      last_edited_at: "2026-06-01T00:00:00Z",
      metadata: {},
    };
    const { client, updateCalls } = makeSetStageMock(piece, null);

    const result = await setStage(client, "piece-1", "line");
    expect(result).toMatchObject({ allowed: true, transition: "retreat" });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]!.payload.editorial_stage).toBe("line");
  });
});
