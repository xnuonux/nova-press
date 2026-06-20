"use client";

/**
 * newsletter send panel ... the writer-commanded blast, never automatic.
 *
 * "send to subscribers" opens a preview: the exact subject + body that will go
 * out, the real confirmed-recipient count, and a staleness nudge if the
 * newsletter predates the piece's last edit. only an explicit "send now ..."
 * commits, with the one-time token the preview minted. a second click after a
 * completed send reports "already sent", never re-blasts. dev sends are stubbed,
 * so this is safe to exercise without mailing anyone.
 */

import { useCallback, useState, useTransition } from "react";

import {
  commitNewsletterSendAction,
  prepareNewsletterSendAction,
  type CommitSendResult,
  type PrepareSendResult,
} from "@/app/(authed)/editor/[id]/send-newsletter-action";

const PREPARE_FAIL: Record<string, string> = {
  auth: "you're not signed in.",
  "not-found": "couldn't find this piece.",
  "no-newsletter": "make a newsletter version first ... repurpose the piece, then send.",
  empty: "the newsletter is empty ... add some words first.",
  error: "something went sideways ... try again in a sec.",
};

export function NewsletterSendPanel({
  pieceId,
  published,
}: {
  pieceId: string;
  published: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [prep, setPrep] = useState<PrepareSendResult | null>(null);
  const [result, setResult] = useState<CommitSendResult | null>(null);
  const [pending, startTransition] = useTransition();

  const prepare = useCallback(() => {
    setResult(null);
    setPrep(null);
    setOpen(true);
    startTransition(async () => {
      setPrep(await prepareNewsletterSendAction(pieceId));
    });
  }, [pieceId]);

  const commit = useCallback((token: string) => {
    startTransition(async () => {
      setResult(await commitNewsletterSendAction(token));
    });
  }, []);

  // the blast only makes sense once the piece is live.
  if (!published) return null;

  return (
    <>
      <button
        type="button"
        onClick={prepare}
        className="np-warm inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ background: "var(--nova-accent-soft)", color: "var(--nova-accent)" }}
      >
        send to subscribers
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "var(--lunari-overlay)", backdropFilter: "blur(3px)" }}
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="np-rise w-full max-w-lg rounded-xl border p-7"
            style={{ background: "var(--lunari-bg-surface)", borderColor: "var(--lunari-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-xl" style={{ color: "var(--lunari-fg-primary)" }}>
              send to subscribers
            </h2>

            {pending && !prep ? (
              <p
                className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em]"
                style={{ color: "var(--lunari-fg-subtle)" }}
              >
                checking ...
              </p>
            ) : null}

            {prep && !prep.ok ? (
              <p
                className="mt-4 font-serif text-base leading-relaxed"
                style={{ color: "var(--lunari-fg-muted)" }}
              >
                {PREPARE_FAIL[prep.reason] ?? PREPARE_FAIL.error}
              </p>
            ) : null}

            {prep && prep.ok && prep.alreadySent ? (
              <p
                className="mt-4 font-serif text-base leading-relaxed"
                style={{ color: "var(--lunari-fg-muted)" }}
              >
                this edition already went out{prep.sentCount ? ` to ${prep.sentCount}` : ""} ...
                edit the piece and refresh the newsletter to send a new version.
              </p>
            ) : null}

            {result ? (
              <SendSummary result={result} />
            ) : prep && prep.ok && !prep.alreadySent ? (
              <div className="mt-4">
                <p
                  className="font-mono text-[11px] uppercase tracking-[0.2em]"
                  style={{ color: "var(--lunari-fg-subtle)" }}
                >
                  {prep.recipientCount} confirmed {prep.recipientCount === 1 ? "reader" : "readers"}
                  {prep.stale ? " · newsletter is older than the piece" : ""}
                </p>
                <p
                  className="mt-1 font-serif text-lg"
                  style={{ color: "var(--lunari-fg-primary)" }}
                >
                  {prep.subject}
                </p>
                <p
                  className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap font-serif text-sm leading-relaxed"
                  style={{ color: "var(--lunari-fg-muted)" }}
                >
                  {prep.bodyPreview}
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={pending || prep.recipientCount === 0}
                    onClick={() => commit(prep.sendToken)}
                    className="np-btn rounded-md px-4 py-2 font-sans text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: "var(--nova-accent)", color: "var(--lunari-bg-deep)" }}
                  >
                    {pending
                      ? "sending ..."
                      : prep.recipientCount === 0
                        ? "no one to send to yet"
                        : `send now to ${prep.recipientCount}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                    className="np-warm font-mono text-[11px] uppercase tracking-[0.18em]"
                    style={{ color: "var(--lunari-fg-subtle)" }}
                  >
                    not yet
                  </button>
                </div>
              </div>
            ) : null}

            {result || (prep && (!prep.ok || prep.alreadySent)) ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="np-warm mt-6 font-mono text-[11px] uppercase tracking-[0.18em]"
                style={{ color: "var(--lunari-fg-subtle)" }}
              >
                close
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function SendSummary({ result }: { result: CommitSendResult }) {
  if (!result.ok) {
    const msg =
      result.reason === "changed"
        ? "the piece changed since the preview ... reopen and review the new version before sending."
        : "couldn't send ... try again in a sec.";
    return (
      <p
        className="mt-4 font-serif text-base leading-relaxed"
        style={{ color: "var(--lunari-fg-muted)" }}
      >
        {msg}
      </p>
    );
  }
  if (result.alreadySent) {
    return (
      <p
        className="mt-4 font-serif text-base leading-relaxed"
        style={{ color: "var(--lunari-fg-muted)" }}
      >
        this edition already went out.
      </p>
    );
  }
  const delivered = result.sent + result.stubbed;
  return (
    <div className="mt-4">
      <p className="font-serif text-lg" style={{ color: "var(--lunari-fg-primary)" }}>
        sent to {delivered} {delivered === 1 ? "reader" : "readers"}.
      </p>
      <p
        className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em]"
        style={{ color: "var(--lunari-fg-subtle)" }}
      >
        {result.stubbed > 0 ? `${result.stubbed} stubbed (dev) · ` : ""}
        {result.failed > 0 ? `${result.failed} failed` : "no failures"}
      </p>
    </div>
  );
}
