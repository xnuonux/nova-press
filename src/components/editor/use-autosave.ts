/**
 * autosave for the writing room. debounce edits, serialize writes, and only
 * acknowledge a flush once every revision observed by the queue is saved.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { createSaveQueue, type SaveState } from "@/lib/editor/save-queue";
import type { SaveAcknowledgement } from "@/lib/editor/save-handshake";

export type AutosaveState = SaveState;
const DEBOUNCE_MS = 1500;

export function formatSavedLabel(state: AutosaveState, lastSavedAt: number | null, now: number): string {
  if (state === "saving") return "saving...";
  if (state === "error") return "couldn't save";
  if (state === "idle" || lastSavedAt === null) return "ready";
  const seconds = Math.max(0, Math.floor((now - lastSavedAt) / 1000));
  if (seconds < 5) return "saved just now";
  if (seconds < 60) return `saved ${seconds}s ago`;
  return `saved ${Math.floor(seconds / 60)}m ago`;
}

export interface UseAutosaveOptions { trigger: unknown; onSave: () => Promise<void>; }
export interface UseAutosaveResult { state: AutosaveState; savedLabel: string; }

export function useAutosave({ trigger, onSave }: UseAutosaveOptions): UseAutosaveResult {
  const [state, setState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const onSaveRef = useRef(onSave);
  const lastTrigger = useRef(trigger);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<ReturnType<typeof createSaveQueue> | null>(null);
  onSaveRef.current = onSave;

  // create per-effect, not once per render: strict-mode's setup/cleanup replay
  // must not leave the mounted editor holding an already disposed queue.
  useEffect(() => {
    const queue = createSaveQueue({
      save: () => onSaveRef.current(),
      onState: setState,
      onSaved: () => setLastSavedAt(Date.now()),
    });
    queueRef.current = queue;
    const onFlush = (event: Event) => {
      const requestedId: unknown = (event as CustomEvent<{ requestId?: unknown }>).detail?.requestId;
      const requestId = typeof requestedId === "string" ? requestedId : undefined;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
      void queue.flush().then(
        () => acknowledge({ requestId, ok: true }),
        () => acknowledge({ requestId, ok: false, error: "your draft could not be saved. the pass did not run." }),
      );
    };
    const acknowledge = (detail: SaveAcknowledgement) => {
      if (queueRef.current === queue) {
        document.dispatchEvent(new CustomEvent("nova:save-flushed", { detail }));
      }
    };
    document.addEventListener("nova:flush-save", onFlush);
    return () => {
      document.removeEventListener("nova:flush-save", onFlush);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
      queueRef.current = null;
      queue.dispose();
    };
  }, []);

  useEffect(() => {
    // skip mount and strict-mode replay; do not save a newly opened document.
    if (Object.is(lastTrigger.current, trigger)) return;
    lastTrigger.current = trigger;
    const queue = queueRef.current;
    if (!queue) return;
    queue.markDirty();
    // includes title edits, which the plate body event alone does not cover.
    document.dispatchEvent(new CustomEvent("nova:piece-edited"));
    const timer = setTimeout(() => {
      timerRef.current = null;
      // failure is represented by the chip, and remains dirty for a later retry.
      void queue.flush().catch(() => {});
    }, DEBOUNCE_MS);
    timerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (timerRef.current === timer) timerRef.current = null;
    };
  }, [trigger]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const savedLabel = useMemo(() => formatSavedLabel(state, lastSavedAt, now), [state, lastSavedAt, now]);
  return { state, savedLabel };
}
