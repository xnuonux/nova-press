"use client";

import { useState } from "react";

// the share row for a published piece. mono text labels rather than the
// usual social glyphs ... quieter, on-brand with the eyebrow type. the
// only client js on the reading route, and it stays tiny.
export function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked (insecure context, denied permission) ... no-op,
      // the x / linkedin links still work.
    }
  }

  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    title,
  )}&url=${encodeURIComponent(url)}`;
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.22em]">
      <button type="button" onClick={copy} className="np-share-link" data-active={copied}>
        {copied ? "copied." : "copy link"}
      </button>
      <a href={x} target="_blank" rel="noopener noreferrer" className="np-share-link">
        share on x
      </a>
      <a href={linkedin} target="_blank" rel="noopener noreferrer" className="np-share-link">
        linkedin
      </a>
    </div>
  );
}
