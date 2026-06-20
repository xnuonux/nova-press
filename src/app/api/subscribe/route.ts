import { NextResponse, type NextRequest } from "next/server";

import { addSubscriber, logEmail } from "@/lib/db/subscribers";
import { getPublishedPieceOwner } from "@/lib/db/pieces";
import { getMailer } from "@/lib/email/mailer";
import { confirmEmail } from "@/lib/email/messages";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// public + anonymous: a reader on /p/[slug] leaves their email for the writer.
// no auth gate (the reader isn't signed in). service-role throughout: resolve
// the piece's owner by slug under the published + shareable gate, then insert
// under that owner. you can only subscribe to a real live piece ... you can't
// seed a stranger's list by guessing user ids, because the owner is derived
// from a published slug, never taken from the request.
//
// since this is anonymous + service-role, it carries three abuse gates: a basic
// per-ip rate limit, a honeypot field, and a deliberately opaque response that
// never reveals whether an email was already on a writer's list (that would be
// a membership oracle on rls-protected data). a shared rate limiter + double
// opt-in are the heavier follow-ups, tracked for when the send layer ships.
const SUBSCRIBE_LIMIT = 8;
const SUBSCRIBE_WINDOW_MS = 60_000;
// at most one confirm email per (writer, email) per window ... a per-destination
// ceiling so a scripted subscribe loop can't mailbomb a victim's inbox even from
// rotating ips (the per-ip limit above doesn't catch that).
const CONFIRM_SEND_WINDOW_MS = 5 * 60_000;

export async function POST(request: NextRequest) {
  // basic per-ip throttle: kills a scripted list-poisoning loop from one source.
  const limited = rateLimit(`subscribe:${clientIp(request)}`, SUBSCRIBE_LIMIT, SUBSCRIBE_WINDOW_MS);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, error: "slow down a sec ... try again in a moment" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const { slug, email, website } = (body ?? {}) as {
    slug?: unknown;
    email?: unknown;
    website?: unknown;
  };

  // honeypot: a human never fills the hidden field. pretend success so a bot
  // can't tell it was caught, and never touch the db.
  if (typeof website === "string" && website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  if (typeof slug !== "string" || slug.length === 0 || slug.length > 200) {
    return NextResponse.json({ ok: false, error: "missing piece" }, { status: 400 });
  }
  if (typeof email !== "string" || email.length === 0 || email.length > 320) {
    return NextResponse.json(
      { ok: false, error: "that email doesn't look right" },
      { status: 400 },
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const owner = await getPublishedPieceOwner(admin, slug);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "this piece isn't published" }, { status: 404 });
    }
    const result = await addSubscriber(admin, {
      userId: owner.userId,
      email,
      pieceId: owner.pieceId,
      slug,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    // double opt-in: send the confirm email only when the capture warrants it (a
    // new or re-opening subscription), throttled per destination. an
    // already-confirmed re-subscribe sends nothing. the send is dev-stubbed and
    // logged either way; a send/log failure never changes the opaque response.
    if (result.sendConfirm && result.confirmToken) {
      const sendGate = rateLimit(
        `confirm-send:${owner.userId}:${result.email}`,
        1,
        CONFIRM_SEND_WINDOW_MS,
      );
      if (sendGate.allowed) {
        try {
          const origin = new URL(request.url).origin;
          const confirmUrl = `${origin}/api/subscribe/confirm?token=${result.confirmToken}`;
          const msg = confirmEmail(confirmUrl);
          const sent = await getMailer().send({
            to: result.email,
            subject: msg.subject,
            text: msg.text,
            kind: "confirm",
          });
          await logEmail(admin, {
            userId: owner.userId,
            pieceId: owner.pieceId,
            kind: "confirm",
            toEmail: result.email,
            subject: msg.subject,
            status: sent.stubbed ? "stubbed" : sent.ok ? "sent" : "failed",
            providerId: sent.providerId ?? null,
            error: sent.error ?? null,
          });
        } catch (err) {
          reportError(err, { tag: "confirm-send-failed", slug });
        }
      }
    }

    // opaque success: a fresh capture, a re-opened one, and an already-confirmed
    // membership all return the exact same body, so the response can't be used to
    // confirm whether an email follows a given writer.
    return NextResponse.json({ ok: true });
  } catch (err) {
    reportError(err, { tag: "subscribe-failed", slug });
    return NextResponse.json(
      { ok: false, error: "couldn't save that ... try again" },
      { status: 502 },
    );
  }
}
