import { describe, expect, it, vi } from "vitest";

import {
  addSubscriber,
  confirmSubscriber,
  isUuid,
  isValidEmail,
  listConfirmedSubscribers,
  logEmail,
  unsubscribeByToken,
} from "./subscribers";

type AdminClient = Parameters<typeof addSubscriber>[0];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// a chainable supabase-builder stub. select/update/eq return the same builder;
// insert resolves directly; maybeSingle resolves to `terminal`; awaiting the
// builder (a list query, or update().eq()) also resolves to `terminal`. each
// from() call pulls the next builder from a queue so a multi-step function
// (select-then-insert) can return different results per step.
function chain(terminal: unknown) {
  const b: Record<string, unknown> = {};
  b.select = vi.fn(() => b);
  b.update = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.neq = vi.fn(() => b);
  b.insert = vi.fn(() => Promise.resolve(terminal));
  b.maybeSingle = vi.fn(() => Promise.resolve(terminal));
  b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(terminal).then(res, rej);
  return b;
}

function adminWith(...builders: ReturnType<typeof chain>[]) {
  let i = 0;
  const from = vi.fn(() => builders[Math.min(i++, builders.length - 1)]);
  return { admin: { from } as unknown as AdminClient, from };
}

describe("isValidEmail", () => {
  it("accepts a normal address", () => {
    expect(isValidEmail("dom@nova.press")).toBe(true);
  });
  it("rejects junk", () => {
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});

describe("isUuid", () => {
  it("accepts a uuid, rejects junk", () => {
    expect(isUuid("3f1a2b4c-5d6e-7f80-9a1b-2c3d4e5f6071")).toBe(true);
    expect(isUuid("nope")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe("addSubscriber", () => {
  it("inserts a NEW capture as pending with a fresh confirm token, sendConfirm:true", async () => {
    const select = chain({ data: null, error: null }); // no existing row
    const insert = chain({ error: null });
    const { admin } = adminWith(select, insert);
    const r = await addSubscriber(admin, {
      userId: "w1",
      email: "  Dom@Nova.Press ",
      pieceId: "p1",
      slug: "s1",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.sendConfirm).toBe(true);
    expect(r.confirmToken).toMatch(UUID_RE);
    expect(r.email).toBe("dom@nova.press");
    const insertArg = ((insert.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] ??
      {}) as Record<string, unknown>;
    expect(insertArg).toMatchObject({
      user_id: "w1",
      email: "dom@nova.press",
      status: "pending",
    });
    expect(insertArg.confirm_token).toMatch(UUID_RE);
  });

  it("is an opaque NO-OP (no email) for an already-confirmed subscriber", async () => {
    const select = chain({ data: { id: "s1", status: "subscribed" }, error: null });
    const { admin } = adminWith(select);
    const r = await addSubscriber(admin, { userId: "w1", email: "dom@nova.press" });
    expect(r).toEqual({
      ok: true,
      sendConfirm: false,
      confirmToken: null,
      email: "dom@nova.press",
    });
  });

  it("RESTARTS the opt-in for an unsubscribed row (new token, back to pending)", async () => {
    const select = chain({ data: { id: "s1", status: "unsubscribed" }, error: null });
    // the guarded restart update returns the affected row, so sendConfirm is true.
    const update = chain({ data: { id: "s1" }, error: null });
    const { admin } = adminWith(select, update);
    const r = await addSubscriber(admin, { userId: "w1", email: "dom@nova.press" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.sendConfirm).toBe(true);
    expect(r.confirmToken).toMatch(UUID_RE);
    const updateArg = ((update.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] ??
      {}) as Record<string, unknown>;
    expect(updateArg).toMatchObject({ status: "pending", confirmed_at: null });
    expect(updateArg.confirm_token).toMatch(UUID_RE);
  });

  it("does NOT clobber a row that got confirmed mid-race (restart guard -> opaque no-op)", async () => {
    // select saw 'pending', but the guarded update (.neq status subscribed) matches
    // 0 rows because the row was confirmed between read and write. never overwrite
    // a good token; return the opaque no-op an already-confirmed capture would.
    const select = chain({ data: { id: "s1", status: "pending" }, error: null });
    const update = chain({ data: null, error: null });
    const { admin } = adminWith(select, update);
    const r = await addSubscriber(admin, { userId: "w1", email: "dom@nova.press" });
    expect(r).toEqual({
      ok: true,
      sendConfirm: false,
      confirmToken: null,
      email: "dom@nova.press",
    });
  });

  it("rejects a bad email before touching the db", async () => {
    const { admin, from } = adminWith(chain({ data: null, error: null }));
    const r = await addSubscriber(admin, { userId: "w1", email: "nope" });
    expect(from).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
  });
});

describe("confirmSubscriber", () => {
  it("confirms a pending row by its single-use token", async () => {
    const { admin } = adminWith(chain({ data: { id: "s1" }, error: null }));
    const r = await confirmSubscriber(admin, "3f1a2b4c-5d6e-7f80-9a1b-2c3d4e5f6071");
    expect(r).toEqual({ ok: true, confirmed: true });
  });

  it("returns confirmed:false when no pending row matches", async () => {
    const { admin } = adminWith(chain({ data: null, error: null }));
    const r = await confirmSubscriber(admin, "3f1a2b4c-5d6e-7f80-9a1b-2c3d4e5f6071");
    expect(r).toEqual({ ok: true, confirmed: false });
  });

  it("short-circuits a non-uuid token with no db hit", async () => {
    const { admin, from } = adminWith(chain({ data: null, error: null }));
    const r = await confirmSubscriber(admin, "not-a-uuid");
    expect(from).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, confirmed: false });
  });
});

describe("unsubscribeByToken", () => {
  it("unsubscribes by the stable token", async () => {
    const { admin } = adminWith(chain({ data: { id: "s1" }, error: null }));
    const r = await unsubscribeByToken(admin, "3f1a2b4c-5d6e-7f80-9a1b-2c3d4e5f6071");
    expect(r).toEqual({ ok: true, unsubscribed: true });
  });

  it("short-circuits a non-uuid token", async () => {
    const { admin, from } = adminWith(chain({ data: null, error: null }));
    const r = await unsubscribeByToken(admin, "junk");
    expect(from).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, unsubscribed: false });
  });
});

describe("listConfirmedSubscribers", () => {
  it("maps confirmed rows to the recipient shape (with unsubscribe token)", async () => {
    const rows = [
      {
        id: "s1",
        email: "a@x.com",
        status: "subscribed",
        confirmed_at: "2026-01-01",
        unsubscribe_token: "tok-1",
      },
    ];
    const { admin } = adminWith(chain({ data: rows, error: null }));
    const out = await listConfirmedSubscribers(admin as never, "w1");
    expect(out).toEqual([
      {
        id: "s1",
        email: "a@x.com",
        status: "subscribed",
        confirmedAt: "2026-01-01",
        unsubscribeToken: "tok-1",
      },
    ]);
  });

  it("returns [] on error", async () => {
    const { admin } = adminWith(chain({ data: null, error: { message: "boom" } }));
    const out = await listConfirmedSubscribers(admin as never, "w1");
    expect(out).toEqual([]);
  });
});

describe("logEmail", () => {
  it("inserts an np_email_log row and reports ok", async () => {
    const b = chain({ error: null });
    const { admin } = adminWith(b);
    const r = await logEmail(admin as never, {
      userId: "w1",
      kind: "confirm",
      toEmail: "a@x.com",
      status: "stubbed",
    });
    expect(r).toEqual({ ok: true });
    const arg = ((b.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] ?? {}) as Record<
      string,
      unknown
    >;
    expect(arg).toMatchObject({
      user_id: "w1",
      kind: "confirm",
      to_email: "a@x.com",
      status: "stubbed",
    });
  });

  it("never throws on a db error", async () => {
    const b = chain({ error: { message: "boom" } });
    const { admin } = adminWith(b);
    const r = await logEmail(admin as never, {
      userId: "w1",
      kind: "newsletter",
      toEmail: "a@x.com",
      status: "failed",
    });
    expect(r).toEqual({ ok: false });
  });
});
