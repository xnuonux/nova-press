/**
 * autosave for the writing room.
 *
 * watches a trigger value, debounces 1500ms, then calls onSave and reflects
 * the real result in the chip label. the next edit after a failed save
 * re-triggers the debounce, so a transient failure self-heals as the writer
 * keeps typing.
 */

import { useEffect, useMemo, useRef, useState } from "react";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

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
  if (state === "error") return "couldn't save";
  if (state === "idle" || lastSavedAt === null) return "ready";
  const seconds = Math.max(0, Math.floor((now - lastSavedAt) / 1000));
  if (seconds < 5) return "saved just now";
  if (seconds < 60) return `saved ${seconds}s ago`;
  return `saved ${Math.floor(seconds / 60)}m ago`;
}

export interface UseAutosaveOptions {
  // a lightweight value that changes whenever the piece changes (title +
  // a body revision counter). the actual content to persist is read inside
  // onSave, so we don't mirror the whole document into react state.
  trigger: unknown;
  onSave: () => Promise<void>;
}

export interface UseAutosaveResult {
  state: AutosaveState;
  savedLabel: string;
}

export function useAutosave({ trigger, onSave }: UseAutosaveOptions): UseAutosaveResult {
  const [state, setState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const isFirstRun = useRef(true);
  // the live debounce timer, so an outside flush can cancel it (see below).
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // keep the latest onSave without making it a dependency of the debounce
  // effect ... otherwise a new closure on every render would reset the timer.
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // skip the mount pass so a freshly loaded piece never flashes "saving..."
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    let cancelled = false;
    setState("saving");
    const timer = setTimeout(async () => {
      timerRef.current = null;
      try {
        await onSaveRef.current();
        if (cancelled) return;
        setState("saved");
        setLastSavedAt(Date.now());
      } catch {
        if (cancelled) return;
        setState("error");
      }
    }, DEBOUNCE_MS);
    timerRef.current = timer;
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (timerRef.current === timer) timerRef.current = null;
    };
  }, [trigger]);

  // let the editorial panel force a pending save to land NOW: it runs a pass
  // against the SAVED body, so the body must be current first. cancelling the
  // pending debounce is the point ... otherwise that timer would fire AFTER the
  // pass and bump last_edited_at past the pass's watermark, re-staling a fresh
  // pass. when nothing is pending the body on disk is already current, so we
  // skip the redundant save (which would falsely stale every other stage's
  // pass) and just acknowledge. fires nova:save-flushed when settled either way.
  useEffect(() => {
    const onFlush = () => {
      const pending = timerRef.current !== null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!pending) {
        document.dispatchEvent(new CustomEvent("nova:save-flushed"));
        return;
      }
      void (async () => {
        try {
          setState("saving");
          await onSaveRef.current();
          setState("saved");
          setLastSavedAt(Date.now());
        } catch {
          setState("error");
        } finally {
          document.dispatchEvent(new CustomEvent("nova:save-flushed"));
        }
      })();
    };
    document.addEventListener("nova:flush-save", onFlush);
    return () => document.removeEventListener("nova:flush-save", onFlush);
  }, []);

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
