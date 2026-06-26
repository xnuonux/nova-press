import { describe, expect, it, vi } from "vitest";

import {
  createDraftPiece,
  getPieceById,
  listPiecesForUser,
  listPieceTextsForWork,
  publishPiece,
  savePieceContent,
} from "./pieces";

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
    ).toEqual(["excerpt", "id", "last_edited_at", "slug", "status", "title", "word_count"]);
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

function makeUpdateMock(error: unknown = null, row: unknown = { work_id: null }) {
  // savePieceContent now RETURNs work_id: update().eq().select().maybeSingle()
  const maybeSingle = vi.fn().mockResolvedValue({ data: error ? null : row, error });
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { from } as unknown as ServerClient,
    from,
    update,
    eq,
    select,
    maybeSingle,
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

  it("returns the piece's work_id from the same write (drives the binder rollup gate)", async () => {
    const { client } = makeUpdateMock(null, { work_id: "work-123" });
    await expect(savePieceContent(client, "piece-uuid", sampleUpdate)).resolves.toEqual({
      workId: "work-123",
    });
  });

  it("returns a null workId for a standalone library piece", async () => {
    const { client } = makeUpdateMock(null, { work_id: null });
    await expect(savePieceContent(client, "piece-uuid", sampleUpdate)).resolves.toEqual({
      workId: null,
    });
  });
});

// listPieceTextsForWork: from().select("body").eq("work_id").neq("status").order().limit()
function makeWorkTextsMock(rows: unknown[] | null = [], error: unknown = null) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error });
  const order = vi.fn(() => ({ limit }));
  const neq = vi.fn(() => ({ order }));
  const eq = vi.fn(() => ({ neq }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as ServerClient,
    from,
    select,
    eq,
    neq,
    order,
    limit,
  };
}

const textBody = [{ type: "p", children: [{ text: "the cold stove waiting" }] }];
const emptyBody = [{ type: "p", children: [{ text: "" }] }];

describe("listPieceTextsForWork", () => {
  it("scopes the read to the work via work_id (the heart of work-scoped voice)", async () => {
    const { client, from, eq } = makeWorkTextsMock([]);
    await listPieceTextsForWork(client, "work-123");
    expect(from).toHaveBeenCalledWith("np_pieces");
    expect(eq).toHaveBeenCalledWith("work_id", "work-123");
  });

  it("excludes archived pieces and orders by last_edited_at desc", async () => {
    const { client, neq, order } = makeWorkTextsMock([]);
    await listPieceTextsForWork(client, "work-123");
    expect(neq).toHaveBeenCalledWith("status", "archived");
    expect(order).toHaveBeenCalledWith("last_edited_at", { ascending: false });
  });

  it("honors the sample limit (default 8, override passes through)", async () => {
    const a = makeWorkTextsMock([]);
    await listPieceTextsForWork(a.client, "work-123");
    expect(a.limit).toHaveBeenCalledWith(8);
    const b = makeWorkTextsMock([]);
    await listPieceTextsForWork(b.client, "work-123", 3);
    expect(b.limit).toHaveBeenCalledWith(3);
  });

  it("returns each piece's plain text, dropping empty bodies", async () => {
    const { client } = makeWorkTextsMock([{ body: textBody }, { body: emptyBody }]);
    await expect(listPieceTextsForWork(client, "work-123")).resolves.toEqual([
      "the cold stove waiting",
    ]);
  });

  it("throws when the client returns an error", async () => {
    const { client } = makeWorkTextsMock(null, { message: "no work read" });
    await expect(listPieceTextsForWork(client, "work-123")).rejects.toThrow(/no work read/);
  });
});

// publishPiece does a read (getPieceById: from().select().eq().maybeSingle())
// then an update (from().update().eq().select().maybeSingle()). one fake from()
// serves both chains; updateResults are returned in sequence so we can stage a
// 23505 collision followed by a success.
function makePublishMock(piece: unknown, updateResults: Array<{ data: unknown; error: unknown }>) {
  let updateCalls = 0;
  const getMaybeSingle = vi.fn().mockResolvedValue({ data: piece, error: null });
  const getEq = vi.fn(() => ({ maybeSingle: getMaybeSingle }));
  const select = vi.fn(() => ({ eq: getEq }));
  const updMaybeSingle = vi.fn(() => {
    const r = updateResults[Math.min(updateCalls, updateResults.length - 1)];
    updateCalls += 1;
    return Promise.resolve(r);
  });
  const updSelect = vi.fn(() => ({ maybeSingle: updMaybeSingle }));
  const updEq = vi.fn(() => ({ select: updSelect }));
  const update = vi.fn(() => ({ eq: updEq }));
  const from = vi.fn(() => ({ select, update }));
  return {
    client: { from } as unknown as ServerClient,
    update,
    updateCalls: () => updateCalls,
  };
}

const draft = {
  id: "p1",
  title: "The Title",
  body: [{ type: "p", children: [{ text: "hello world" }] }],
  status: "draft",
  slug: null,
  published_at: null,
};

describe("publishPiece", () => {
  it("publishes a draft and returns the slug postgres confirmed", async () => {
    const { client, update } = makePublishMock(draft, [
      { data: { slug: "the-title" }, error: null },
    ]);
    await expect(publishPiece(client, "p1")).resolves.toEqual({ slug: "the-title" });
    const payload = (update.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(payload.status).toBe("published");
    expect(payload.visibility).toBe("public");
    expect(typeof payload.published_at).toBe("string");
  });

  it("retries with a suffix on a 23505 slug collision, then succeeds", async () => {
    const { client, updateCalls } = makePublishMock(draft, [
      { data: null, error: { code: "23505" } },
      { data: { slug: "the-title-ab12cd" }, error: null },
    ]);
    await expect(publishPiece(client, "p1")).resolves.toEqual({ slug: "the-title-ab12cd" });
    expect(updateCalls()).toBe(2);
  });

  it("does not retry when an already-published piece collides on its own slug", async () => {
    const live = { ...draft, status: "published", slug: "the-title" };
    const { client, updateCalls } = makePublishMock(live, [
      { data: null, error: { code: "23505" } },
    ]);
    await expect(publishPiece(client, "p1")).rejects.toThrow(/already in use/);
    expect(updateCalls()).toBe(1);
  });

  it("throws on a zero-row update (rls filtered or row vanished), not a false success", async () => {
    const { client } = makePublishMock(draft, [{ data: null, error: null }]);
    await expect(publishPiece(client, "p1")).rejects.toThrow(/not found or not owned/);
  });

  it("refuses to publish an empty piece, before touching the db", async () => {
    const empty = { ...draft, body: [] };
    const { client, updateCalls } = makePublishMock(empty, [{ data: { slug: "x" }, error: null }]);
    await expect(publishPiece(client, "p1")).rejects.toThrow(/empty piece/);
    expect(updateCalls()).toBe(0);
  });

  it("throws when the piece does not exist", async () => {
    const { client } = makePublishMock(null, [{ data: { slug: "x" }, error: null }]);
    await expect(publishPiece(client, "missing")).rejects.toThrow(/piece not found/);
  });
});
