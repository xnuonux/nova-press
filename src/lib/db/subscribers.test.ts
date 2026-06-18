import { describe, expect, it, vi } from "vitest";

import { addSubscriber, isValidEmail } from "./subscribers";

type AdminClient = Parameters<typeof addSubscriber>[0];

function makeInsertMock(error: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ insert });
  const admin = { from } as unknown as AdminClient;
  return { admin, from, insert };
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
    expect(isValidEmail("a@b.c d")).toBe(false);
  });

  it("rejects an over-long address", () => {
    expect(isValidEmail("a".repeat(330) + "@x.co")).toBe(false);
  });
});

describe("addSubscriber", () => {
  it("inserts a normalized (lowercased, trimmed) email for the writer", async () => {
    const { admin, from, insert } = makeInsertMock();
    const r = await addSubscriber(admin, {
      userId: "w1",
      email: "  Dom@Nova.Press ",
      pieceId: "p1",
      slug: "s1",
    });
    expect(from).toHaveBeenCalledWith("np_subscriber");
    expect(insert).toHaveBeenCalledWith({
      user_id: "w1",
      email: "dom@nova.press",
      piece_id: "p1",
      source_slug: "s1",
    });
    expect(r).toEqual({ ok: true, already: false });
  });

  it("treats a unique-violation (23505) as an idempotent success", async () => {
    const { admin } = makeInsertMock({ code: "23505", message: "dup" });
    const r = await addSubscriber(admin, { userId: "w1", email: "dom@nova.press" });
    expect(r).toEqual({ ok: true, already: true });
  });

  it("rejects a bad email before touching the db", async () => {
    const { admin, insert } = makeInsertMock();
    const r = await addSubscriber(admin, { userId: "w1", email: "nope" });
    expect(insert).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
  });

  it("surfaces a generic failure on other db errors", async () => {
    const { admin } = makeInsertMock({ code: "55000", message: "boom" });
    const r = await addSubscriber(admin, { userId: "w1", email: "dom@nova.press" });
    expect(r.ok).toBe(false);
  });
});
