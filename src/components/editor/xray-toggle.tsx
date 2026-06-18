"use client";

/**
 * the "structure" toggle ... the gesture that asks nova to x-ray the draft.
 * lives in the editor chrome, dispatches a custom event the always-mounted spine
 * listens for (so flipping it never re-renders the editable). it mirrors the
 * spine's open/closed state from the nova:xray-state event purely to carry
 * aria-pressed for assistive tech; the gold tint still rides the np-xray-on body
 * class the spine sets.
 */

import { useEffect, useState } from "react";

export function XrayToggle() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onState = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      setActive(!!detail?.active);
    };
    document.addEventListener("nova:xray-state", onState);
    return () => document.removeEventListener("nova:xray-state", onState);
  }, []);

  return (
    <button
      type="button"
      className="np-xray-toggle shrink-0 font-mono text-[11px] uppercase tracking-[0.2em]"
      title="see the argument's structure"
      aria-label="x-ray the structure"
      aria-pressed={active}
      onClick={() => document.dispatchEvent(new CustomEvent("nova:xray-toggle"))}
    >
      structure
    </button>
  );
}
