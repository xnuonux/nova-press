"use server";

import {
  claimDispatch,
  claimRecipient,
  completeDispatch,
  prepareDispatch,
  settleRecipient,
} from "@/lib/db/newsletter-dispatch";
import { getPieceById } from "@/lib/db/pieces";
import { isOutputStale, listOutputsByPiece } from "@/lib/db/repurpose-outputs";
import { listConfirmedSubscribers } from "@/lib/db/subscribers";
import { computeBodyHash } from "@/lib/email/dispatch";
import { getMailer } from "@/lib/email/mailer";
import { appendUnsubscribe, eligibleRecipients, parseNewsletter } from "@/lib/email/newsletter";
import { reportError } from "@/lib/observability/report-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// the writer commands the send in two deliberate steps ... prepare (preview the
// exact edition + the real recipient count, get a one-time token) then commit
// (with that token). this is NEVER auto-fired on publish, and no other caller can
// reach the send without a token minted by a prepare the writer triggered.

export type PrepareSendResult =
  | { ok: false; reason: "auth" | "not-found" | "no-newsletter" | "empty" | "error" }
  | { ok: true; alreadySent: true; completedAt: string | null; sentCount: number }
  | {
      ok: true;
      alreadySent: false;
      subject: string;
      bodyPreview: string;
      recipientCount: number;
      stale: boolean;
      sendToken: string;
    };

export async function prepareNewsletterSendAction(pieceId: string): Promise<PrepareSendResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "auth" };

  try {
    const piece = await getPieceById(supabase, pieceId);
    if (!piece || piece.user_id !== user.id) return { ok: false, reason: "not-found" };

    const outputs = await listOutputsByPiece(supabase, pieceId);
    const newsletter = outputs.find((o) => o.channel === "newsletter");
    if (!newsletter) return { ok: false, reason: "no-newsletter" };

    const { subject, body } = parseNewsletter(newsletter.body, piece.title);
    if (!body.trim()) return { ok: false, reason: "empty" };

    const bodyHash = computeBodyHash(subject, body);
    const stale = isOutputStale(newsletter, piece.last_edited_at);
    const recipients = eligibleRecipients(await listConfirmedSubscribers(supabase, user.id));

    const prepared = await prepareDispatch(supabase, {
      userId: user.id,
      pieceId,
      bodyHash,
      subject,
    });
    if (!prepared) return { ok: false, reason: "error" };
    if (prepared.alreadySent) {
      return {
        ok: true,
        alreadySent: true,
        completedAt: prepared.completedAt ?? null,
        sentCount: prepared.sentCount ?? 0,
      };
    }
    return {
      ok: true,
      alreadySent: false,
      subject,
      bodyPreview: body.slice(0, 600),
      recipientCount: recipients.length,
      stale,
      sendToken: prepared.sendToken ?? "",
    };
  } catch (err) {
    reportError(err, { tag: "prepare-newsletter-send-failed", pieceId });
    return { ok: false, reason: "error" };
  }
}

export type CommitSendResult =
  | { ok: false; reason: "auth" | "not-found" | "changed" | "error" }
  | { ok: true; alreadySent: true }
  | {
      ok: true;
      alreadySent: false;
      recipientCount: number;
      sent: number;
      failed: number;
      stubbed: number;
    };

export async function commitNewsletterSendAction(sendToken: string): Promise<CommitSendResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "auth" };

  try {
    const claim = await claimDispatch(supabase, { userId: user.id, sendToken });
    if (claim.status === "notfound") return { ok: false, reason: "not-found" };
    if (claim.status === "complete") return { ok: true, alreadySent: true };
    const dispatch = claim.dispatch;
    if (!dispatch) return { ok: false, reason: "error" };

    // re-derive the edition at send time and verify it matches what was previewed
    // ... a body edited since preview is a different hash and aborts the send, so
    // the writer can never blast a version they didn't approve (TOCTOU closed).
    const piece = await getPieceById(supabase, dispatch.pieceId);
    if (!piece || piece.user_id !== user.id) return { ok: false, reason: "not-found" };
    const outputs = await listOutputsByPiece(supabase, dispatch.pieceId);
    const newsletter = outputs.find((o) => o.channel === "newsletter");
    if (!newsletter) return { ok: false, reason: "changed" };
    const { subject, body } = parseNewsletter(newsletter.body, piece.title);
    if (computeBodyHash(subject, body) !== dispatch.bodyHash)
      return { ok: false, reason: "changed" };

    const recipients = eligibleRecipients(await listConfirmedSubscribers(supabase, user.id));
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    const mailer = getMailer();

    let sent = 0;
    let failed = 0;
    let stubbed = 0;
    let attempted = 0;

    for (const r of recipients) {
      const email = r.email.trim().toLowerCase();
      // claim first: the unique (dispatch_id, lower(to_email)) makes this
      // exactly-once ... a recipient already reached on a prior run is skipped.
      const claimed = await claimRecipient(supabase, {
        dispatchId: dispatch.id,
        userId: user.id,
        subscriberId: r.id,
        pieceId: dispatch.pieceId,
        email,
        subject,
      });
      if (!claimed.claimed) continue;
      attempted += 1;

      const unsubUrl = base ? `${base}/api/unsubscribe?token=${r.unsubscribeToken}` : "";
      const text = appendUnsubscribe(body, unsubUrl);

      let status: "sent" | "stubbed" | "failed" = "failed";
      let providerId: string | null = null;
      let error: string | null = null;
      try {
        const res = await mailer.send({ to: email, subject, text, kind: "newsletter" });
        status = res.stubbed ? "stubbed" : res.ok ? "sent" : "failed";
        providerId = res.providerId ?? null;
        error = res.error ?? null;
      } catch (err) {
        error = err instanceof Error ? err.message : "send failed";
      }

      if (status === "sent") sent += 1;
      else if (status === "stubbed") stubbed += 1;
      else failed += 1;

      // settle in a way that always records the outcome, so a crash mid-loop
      // leaves an honest per-recipient trail and a resume skips the settled ones.
      await settleRecipient(supabase, {
        dispatchId: dispatch.id,
        email,
        status,
        providerId,
        error,
      });
    }

    await completeDispatch(supabase, {
      dispatchId: dispatch.id,
      attemptedCount: attempted,
      sentCount: sent + stubbed,
      failedCount: failed,
    });

    return {
      ok: true,
      alreadySent: false,
      recipientCount: recipients.length,
      sent,
      failed,
      stubbed,
    };
  } catch (err) {
    reportError(err, { tag: "commit-newsletter-send-failed" });
    return { ok: false, reason: "error" };
  }
}
