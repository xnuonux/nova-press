/**
 * autosave for the writing room.
 *
 * week 1: local-state only. the debounce and the chip states are real, but
 * nothing leaves the browser yet. T-012 swaps the timeout body for a POST to
 * /api/revisions ... the hook shape stays the same.
 */

import { useEffect, useMemo, useRef, useState } from "react";

export type AutosaveState = "idle" | "saving" | "saved";

const DEBOUNCE_MS = 1500;

/**
 * the autosave chip label. pure, so it can be tested without a dom.
 */
export function formatSavedLabel(
  state: AutosaveState,
  lastSavedAt: number | null,
  now: number,
): string {
  if (state === "saving") return "saving...";
  if (state === "idle" || lastSavedAt === null) return "ready";
  const seconds = Math.max(0, Math.floor((now - lastSavedAt) / 1000));
  if (seconds < 5) return "saved just now";
  if (seconds < 60) return `saved ${seconds}s ago`;
  return `saved ${Math.floor(seconds / 60)}m ago`;
}

export interface UseAutosaveResult {
  state: AutosaveState;
  savedLabel: string;
}

/**
 * watches a value, debounces 1500ms, and reports a human autosave label.
 * pass whatever changes when the piece changes (the title and a body revision).
 */
export function useAutosave(watched: unknown): UseAutosaveResult {
  const [state, setState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const isFirstRun = useRef(true);

  // skip the mount pass so a blank draft never flashes "saving..."
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setState("saving");
    const timer = setTimeout(() => {
      // T-012: POST /api/revisions here, then mark saved on the response.
      setState("saved");
      setLastSavedAt(Date.now());
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [watched]);

  // tick once a second so "saved Xs ago" stays honest
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const savedLabel = useMemo(
    () => formatSavedLabel(state, lastSavedAt, now),
    [state, lastSavedAt, now],
  );

  return { state, savedLabel };
}
