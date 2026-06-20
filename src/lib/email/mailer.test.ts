import { describe, expect, it } from "vitest";

import { decideLiveEmail, getMailer, isLiveEmail } from "./mailer";

// the deliberate prod live-switch: the explicit flag PLUS a key PLUS a from.
const LIVE = {
  NOVA_EMAIL_LIVE: "true",
  RESEND_API_KEY: "re_live_key",
  NOVA_EMAIL_FROM: "nova <hi@nova.press>",
};

describe("decideLiveEmail", () => {
  it("is true with the live flag + key + from", () => {
    expect(decideLiveEmail(LIVE)).toBe(true);
  });

  it("is false without the explicit live flag, even with NODE_ENV=production + key + from", () => {
    // the trap: NODE_ENV is 'production' in vercel preview/branch deploys and
    // `next start`, and the shared resend key is everywhere. a NODE_ENV gate
    // would blast from a preview. the live flag is the only switch.
    expect(
      decideLiveEmail({
        NODE_ENV: "production",
        RESEND_API_KEY: "re_live_key",
        NOVA_EMAIL_FROM: "nova <hi@nova.press>",
      }),
    ).toBe(false);
  });

  it("is false on a vercel PREVIEW even if the live flag leaks in", () => {
    expect(decideLiveEmail({ ...LIVE, VERCEL_ENV: "preview" })).toBe(false);
    expect(decideLiveEmail({ ...LIVE, VERCEL_ENV: "development" })).toBe(false);
  });

  it("is true on vercel production with the flag + key + from", () => {
    expect(decideLiveEmail({ ...LIVE, VERCEL_ENV: "production" })).toBe(true);
  });

  it("is false when the resend key is missing or empty", () => {
    expect(decideLiveEmail({ ...LIVE, RESEND_API_KEY: undefined })).toBe(false);
    expect(decideLiveEmail({ ...LIVE, RESEND_API_KEY: "" })).toBe(false);
  });

  it("is false when the from-address is missing or empty", () => {
    expect(decideLiveEmail({ ...LIVE, NOVA_EMAIL_FROM: undefined })).toBe(false);
    expect(decideLiveEmail({ ...LIVE, NOVA_EMAIL_FROM: "" })).toBe(false);
  });

  it("is false for an empty environment", () => {
    expect(decideLiveEmail({})).toBe(false);
  });
});

describe("getMailer (in the test environment)", () => {
  it("returns the stub ... so this suite never opens a socket", async () => {
    // NODE_ENV is 'test' under vitest, so decideLiveEmail is false and getMailer
    // hands back the stub. it returns stubbed:true and never touches the network.
    expect(isLiveEmail()).toBe(false);
    const result = await getMailer().send({
      to: "reader@x.com",
      subject: "hi",
      text: "body",
      kind: "newsletter",
    });
    expect(result).toEqual({ ok: true, stubbed: true, providerId: "stub:newsletter" });
  });

  it("stub marks the kind in the provider id", async () => {
    const result = await getMailer().send({
      to: "reader@x.com",
      subject: "confirm",
      text: "confirm your subscription",
      kind: "confirm",
    });
    expect(result.stubbed).toBe(true);
    expect(result.providerId).toBe("stub:confirm");
  });

  it("the SendResult shape never carries a secret-shaped field", async () => {
    // the api key + auth header must never ride a return value into a server
    // action's response and out to the client send panel. the returned shape is
    // a closed set of safe keys, and no value looks like a bearer key.
    const result = await getMailer().send({
      to: "reader@x.com",
      subject: "hi",
      text: "body",
      kind: "newsletter",
    });
    const allowed = new Set(["ok", "stubbed", "providerId", "error"]);
    for (const key of Object.keys(result)) expect(allowed.has(key)).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/authorization|bearer|re_live|api[_-]?key/i);
  });
});
