"use client";

/**
 * publish control in the editor footer. a draft shows "publish"; once live it
 * becomes a quiet row ... view the piece, copy its link, or push a fresh
 * version. closes the loop: write ... ship ... share.
 */

import { useState } from "react";

interface PublishButtonProps {
  initialStatus: string;
  initialSlug: string | null;
  onPublish: () => Promise<
    { ok: true; slug: string; url: string } | { ok: false; error: string }
  >;
}

type State = "idle" | "publishing" | "live" | "error";

const linkClass =
  "font-mono text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-70";

export function PublishButton({ initialStatus, initialSlug, onPublish }: PublishButtonProps) {
  const alreadyLive = initialStatus === "published" && !!initialSlug;
  const [state, setState] = useState<State>(alreadyLive ? "live" : "idle");
  const [url, setUrl] = useState<string | null>(alreadyLive ? `/p/${initialSlug}` : null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function publish() {
    setState("publishing");
    setErrorMsg(null);
    const res = await onPublish();
    if (res.ok) {
      setUrl(res.url);
      setState("live");
    } else {
      setErrorMsg(res.error);
      setState("error");
    }
  }

  async function copy() {
    if (!url) return;
    const absolute = typeof window !== "undefined" ? window.location.origin + url : url;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked (insecure context, denied permission) ... no-op, the
      // view link still works.
    }
  }

  if (state === "live" && url) {
    return (
      <div className="flex items-center gap-4">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={linkClass}
          style={{ color: "var(--nova-accent)" }}
        >
          view
        </a>
        <button type="button" onClick={() => void copy()} className={linkClass}>
          {copied ? "copied" : "copy link"}
        </button>
        <button type="button" onClick={() => void publish()} className={linkClass}>
          republish
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {state === "error" && errorMsg ? (
        <span
          className="max-w-[26ch] truncate font-mono text-[10px] lowercase tracking-[0.08em]"
          style={{ color: "var(--lunari-fg-muted)" }}
          title={errorMsg}
        >
          {errorMsg}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => void publish()}
        disabled={state === "publishing"}
        className="np-btn inline-flex h-7 items-center rounded-full px-3.5 font-mono text-[11px] uppercase tracking-[0.18em] disabled:opacity-50"
        style={{
          background: "var(--nova-accent)",
          color: "var(--lunari-bg-deep)",
        }}
      >
        {state === "publishing" ? "publishing ..." : state === "error" ? "try again" : "publish"}
      </button>
    </div>
  );
}
