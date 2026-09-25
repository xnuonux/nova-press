/** the editor answers the particular flush requested by an editorial pass. */
export interface SaveAcknowledgement {
  requestId?: string;
  ok: boolean;
  error?: string;
}

export function requestSaveFlush(
  target: EventTarget,
  requestId: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 4000;
  if (!requestId || !Number.isFinite(timeoutMs) || timeoutMs < 0) {
    return Promise.reject(new Error("invalid save acknowledgement request."));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      target.removeEventListener("nova:save-flushed", onAck);
      options.signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onAck = (event: Event) => {
      const detail = (event as CustomEvent<SaveAcknowledgement>).detail;
      if (!detail || detail.requestId !== requestId) return;
      if (detail.ok === true) finish();
      else finish(new Error(detail.error || "your draft could not be saved. the pass did not run."));
    };
    const onAbort = () => finish(new Error("the editorial request was cancelled."));
    if (options.signal?.aborted) { onAbort(); return; }
    target.addEventListener("nova:save-flushed", onAck);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(
      () => finish(new Error("the save is not confirmed yet. the pass did not run ... try again after saving.")),
      timeoutMs,
    );
    try {
      target.dispatchEvent(new CustomEvent("nova:flush-save", { detail: { requestId } }));
    } catch (error) {
      finish(error instanceof Error ? error : new Error("could not request a save."));
    }
  });
}
