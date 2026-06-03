import { describe, expect, it, vi } from "vitest";

import { createDraftPiece, getPieceById, listPiecesForUser, savePieceContent } from "./pieces";

type ServerClient = Parameters<typeof listPiecesForUser>[0];

// supabase-js uses chained builders. these helpers fake the chain shape
// each impl uses so we can assert exact method calls without spinning up
// a real client.

function makeListMock(rows: unknown[] | null = [], error: unknown = null) {
  const order = vi.fn().mockResolvedValue({ data: rows, error });
  const neq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ neq }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as ServerClient,
    from,
    select,
    neq,
    order,
  };
}

function makeInsertMock(row: unknown = { id: "new-id" }, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error });
  const selectChain = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select: selectChain }));
  const from = vi.fn(() => ({ insert }));
  return {
    client: { from } as unknown as ServerClient,
    from,
    insert,
    selectChain,
    single,
  };
}

function makeGetMock(row: unknown = null, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as ServerClient,
    from,
    select,
    eq,
    maybeSingle,
  };
}

describe("listPiecesForUser", () => {
  it("queries np_pieces with the expected column projection", async () => {
    const { client, from, select } = makeListMock([]);
    await listPiecesForUser(client);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("np_pieces");
    expect(select).toHaveBeenCalledTimes(1);
    // mock.calls is typed as Array<[]> under vitest's default fn signature;
    // cast the first call's args to a single-string tuple since that's
    // what the impl passes.
    const firstCall = select.mock.calls[0] as unknown as [string];
    const cols = firstCall[0];
    expect(
      cols
        .split(",")
        .map((c) => c.trim())
        .sort(),
    ).toEqual(["excerpt", "id", "last_edited_at", "status", "title", "word_count"]);
  });

  it("excludes archived pieces", async () => {
    const { client, neq } = makeListMock([]);
    await listPiecesForUser(client);
    expect(neq).toHaveBeenCalledWith("status", "archived");
  });

  it("orders by last_edited_at descending", async () => {
    const { client, order } = makeListMock([]);
    await listPiecesForUser(client);
    expect(order).toHaveBeenCalledWith("last_edited_at", { ascending: false });
  });

  it("returns the rows on success", async () => {
    const fakeRows = [
      { id: "a", title: "first", status: "draft" },
      { id: "b", title: "second", status: "published" },
    ];
    const { client } = makeListMock(fakeRows);
    await expect(listPiecesForUser(client)).resolves.toEqual(fakeRows);
  });

  it("returns an empty array when the client returns null data", async () => {
    const { client } = makeListMock(null);
    await expect(listPiecesForUser(client)).resolves.toEqual([]);
  });

  it("throws when the client returns an error", async () => {
    const { client } = makeListMock(null, { message: "kaput" });
    await expect(listPiecesForUser(client)).rejects.toThrow(/kaput/);
  });
});

describe("createDraftPiece", () => {
  it("inserts a row carrying only the user_id (db defaults populate the rest)", async () => {
    const { client, from, insert } = makeInsertMock();
    await createDraftPiece(client, "user-uuid");
    expect(from).toHaveBeenCalledWith("np_pieces");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({ user_id: "user-uuid" });
  });

  it("projects only the id back via select chain", async () => {
    const { client, selectChain } = makeInsertMock();
    await createDraftPiece(client, "user-uuid");
    expect(selectChain).toHaveBeenCalledWith("id");
  });

  it("returns { id } from the inserted row", async () => {
    const { client } = makeInsertMock({ id: "fresh-id" });
    const result = await createDraftPiece(client, "user-uuid");
    expect(result).toEqual({ id: "fresh-id" });
  });

  it("throws when the client returns an error", async () => {
    const { client } = makeInsertMock(null, { message: "no insert" });
    await expect(createDraftPiece(client, "user-uuid")).rejects.toThrow(/no insert/);
  });
});

describe("getPieceById", () => {
  it("queries np_pieces by id with select *", async () => {
    const { client, from, select, eq } = makeGetMock();
    await getPieceById(client, "piece-uuid");
    expect(from).toHaveBeenCalledWith("np_pieces");
    expect(select).toHaveBeenCalledWith("*");
    expect(eq).toHaveBeenCalledWith("id", "piece-uuid");
  });

  it("returns null when no row is found", async () => {
    const { client } = makeGetMock(null);
    await expect(getPieceById(client, "missing")).resolves.toBeNull();
  });

  it("returns the row when found", async () => {
    const fakeRow = { id: "piece-uuid", title: "found" };
    const { client } = makeGetMock(fakeRow);
    await expect(getPieceById(client, "piece-uuid")).resolves.toEqual(fakeRow);
  });

  it("throws when the client returns an error", async () => {
    const { client } = makeGetMock(null, { message: "nope" });
    await expect(getPieceById(client, "any")).rejects.toThrow(/nope/);
  });
});

function makeUpdateMock(error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ error });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { from } as unknown as ServerClient,
    from,
    update,
    eq,
  };
}

const sampleUpdate = {
  title: "a title",
  body: [{ type: "p", children: [{ text: "hi" }] }],
  word_count: 1,
  excerpt: "hi",
};

describe("savePieceContent", () => {
  it("updates the np_pieces table", async () => {
    const { client, from } = makeUpdateMock();
    await savePieceContent(client, "piece-uuid", sampleUpdate);
    expect(from).toHaveBeenCalledWith("np_pieces");
  });

  it("writes title, body, word_count, excerpt plus both autosave timestamps", async () => {
    const { client, update } = makeUpdateMock();
    await savePieceContent(client, "piece-uuid", sampleUpdate);
    expect(update).toHaveBeenCalledTimes(1);
    const payload = (update.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(payload.title).toBe("a title");
    expect(payload.body).toEqual(sampleUpdate.body);
    expect(payload.word_count).toBe(1);
    expect(payload.excerpt).toBe("hi");
    expect(typeof payload.last_autosaved_at).toBe("string");
    expect(typeof payload.last_edited_at).toBe("string");
  });

  it("scopes the update to the piece id (RLS gates user_id)", async () => {
    const { client, eq } = makeUpdateMock();
    await savePieceContent(client, "piece-uuid", sampleUpdate);
    expect(eq).toHaveBeenCalledWith("id", "piece-uuid");
  });

  it("throws when the client returns an error", async () => {
    const { client } = makeUpdateMock({ message: "denied" });
    await expect(savePieceContent(client, "piece-uuid", sampleUpdate)).rejects.toThrow(/denied/);
  });
});
