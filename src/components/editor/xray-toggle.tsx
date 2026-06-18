"use client";

/**
 * the "structure" toggle ... the gesture that asks nova to x-ray the draft.
 * lives in the editor chrome, dispatches a custom event the always-mounted
 * spine listens for (so flipping it never re-renders the editable). the active
 * tint rides the np-xray-on body class the spine sets, so this stays a dumb,
 * stateless button.
 */

export function XrayToggle() {
  return (
    <button
      type="button"
      className="np-xray-toggle shrink-0 font-mono text-[11px] uppercase tracking-[0.2em]"
      title="see the argument's structure"
      aria-label="x-ray the structure"
      onClick={() => document.dispatchEvent(new CustomEvent("nova:xray-toggle"))}
    >
      structure
    </button>
  );
}
