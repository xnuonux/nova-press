import { describe, expect, it } from "vitest";

import {
  appendUnsubscribe,
  eligibleRecipients,
  parseNewsletter,
  type Recipient,
} from "./newsletter";

describe("parseNewsletter", () => {
  it("splits a 'subject:' first line off the body", () => {
    const { subject, body } = parseNewsletter(
      "subject: the page is open\n\nhi there.\nsecond line.",
    );
    expect(subject).toBe("the page is open");
    expect(body).toBe("hi there.\nsecond line.");
  });

  it("is case-insensitive on the subject prefix", () => {
    expect(parseNewsletter("Subject: Hello\n\nbody").subject).toBe("Hello");
    expect(parseNewsletter("SUBJECT:   trimmed   \n\nbody").subject).toBe("trimmed");
  });

  it("skips leading blank lines to find the subject", () => {
    const { subject, body } = parseNewsletter("\n\n  \nsubject: late\n\nthe body");
    expect(subject).toBe("late");
    expect(body).toBe("the body");
  });

  it("falls back to the given subject when there is no subject line", () => {
    const { subject, body } = parseNewsletter("just a body, no subject line", "my piece title");
    expect(subject).toBe("my piece title");
    expect(body).toBe("just a body, no subject line");
  });

  it("falls back to a quiet default when no subject line and no fallback", () => {
    expect(parseNewsletter("body only").subject).toBe("a new piece");
  });

  it("uses the fallback when the subject line is empty after the prefix", () => {
    // 'subject:' with nothing after it does not match the (.+) capture, so the
    // whole line is treated as the body and the fallback subject is used.
    expect(parseNewsletter("subject:", "fallback").subject).toBe("fallback");
  });

  it("degrades a subject-only input to the whole text as the body", () => {
    const { subject, body } = parseNewsletter("subject: lonely");
    expect(subject).toBe("lonely");
    expect(body).toBe("subject: lonely");
  });

  it("handles non-string input without throwing", () => {
    // @ts-expect-error exercising the runtime guard
    const { subject, body } = parseNewsletter(null, "safe");
    expect(subject).toBe("safe");
    expect(body).toBe("");
  });
});

describe("appendUnsubscribe", () => {
  it("appends a plain-text unsubscribe footer with the url", () => {
    const out = appendUnsubscribe("the body", "https://nova.test/u?token=abc");
    expect(out).toContain("the body");
    expect(out).toContain("unsubscribe: https://nova.test/u?token=abc");
  });

  it("returns the body untouched when there is no url", () => {
    expect(appendUnsubscribe("the body", "")).toBe("the body");
    expect(appendUnsubscribe("the body", "   ")).toBe("the body");
  });

  it("does not throw on non-string input", () => {
    // @ts-expect-error runtime guard
    expect(appendUnsubscribe(null, null)).toBe("");
  });
});

describe("eligibleRecipients", () => {
  const sub = (
    id: string,
    email: string,
    status: string,
    confirmedAt: string | null = "2026-01-01T00:00:00Z",
  ): Recipient => ({ id, email, status, confirmedAt });

  it("keeps only confirmed ('subscribed') recipients", () => {
    const out = eligibleRecipients([
      sub("1", "a@x.com", "subscribed"),
      sub("2", "b@x.com", "pending"),
      sub("3", "c@x.com", "unsubscribed"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["1"]);
  });

  it("excludes a 'subscribed' row that has no confirmed_at stamp (consent gate)", () => {
    const out = eligibleRecipients([
      sub("1", "legacy@x.com", "subscribed", null),
      sub("2", "real@x.com", "subscribed", "2026-02-02T00:00:00Z"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["2"]);
  });

  it("treats a blank/whitespace confirmed_at as unconfirmed", () => {
    const out = eligibleRecipients([sub("1", "x@x.com", "subscribed", "   ")]);
    expect(out).toEqual([]);
  });

  it("dedupes case-insensitively by email, keeping the first", () => {
    const out = eligibleRecipients([
      sub("1", "Dom@X.com", "subscribed"),
      sub("2", "dom@x.com", "subscribed"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["1"]);
  });

  it("drops blank and whitespace-only emails", () => {
    const out = eligibleRecipients([
      sub("1", "   ", "subscribed"),
      sub("2", "real@x.com", "subscribed"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["2"]);
  });

  it("returns [] for null / undefined / empty input", () => {
    expect(eligibleRecipients(null)).toEqual([]);
    expect(eligibleRecipients(undefined)).toEqual([]);
    expect(eligibleRecipients([])).toEqual([]);
  });
});
