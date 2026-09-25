/** Client preflight for one mounted editor ... not a server revision lock. */
export type ReleaseIntent =
  | { kind: "publish" }
  | { kind: "schedule"; whenIso: string }
  | { kind: "cancel" };
export type ReleaseReceipt =
  | { kind: "publish"; slug: string; url: string }
  | { kind: "schedule"; scheduledAt: string }
  | { kind: "cancel" };
export type ReleasePhase = "saving" | "sending" | null;
export type ReleaseOutcome =
  | { status: "confirmed"; receipt: ReleaseReceipt; editedWhileSending: boolean }
  | { status: "blocked" | "rejected" | "unconfirmed"; error: string }
  | { status: "busy" | "closed" };

const UNCONFIRMED =
  "the request may have completed, but its result is not confirmed. keep this draft open and check the saved piece in another tab before retrying.";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readReceipt(intent: ReleaseIntent, reply: Record<string, unknown>): ReleaseReceipt | null {
  if (reply.ok !== true) return null;
  if (intent.kind === "publish") {
    // The action's contract is a relative /p/[slug] link, never a remote URL.
    const { slug, url } = reply;
    return typeof slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && url === `/p/${slug}`
      ? { kind: "publish", slug, url }
      : null;
  }
  if (intent.kind === "cancel") {
    return reply.scheduledAt === null ? { kind: "cancel" } : null;
  }
  const received = typeof reply.scheduledAt === "string" ? Date.parse(reply.scheduledAt) : NaN;
  return Number.isFinite(received) && received === Date.parse(intent.whenIso)
    ? { kind: "schedule", scheduledAt: new Date(received).toISOString() }
    : null;
}

export function createReleaseGate(options: {
  target: EventTarget;
  flush: (signal: AbortSignal) => Promise<void>;
  onPhase?: (phase: ReleasePhase) => void;
}) {
  let active = false;
  let closed = false;
  let uncertain = false;
  let controller: AbortController | null = null;
  let removeListener: (() => void) | null = null;

  async function run(intent: ReleaseIntent, action: () => Promise<unknown>): Promise<ReleaseOutcome> {
    if (closed) return { status: "closed" };
    if (active) return { status: "busy" };
    if (uncertain) return { status: "unconfirmed", error: UNCONFIRMED };
    if (intent.kind === "schedule" && !Number.isFinite(Date.parse(intent.whenIso))) {
      return { status: "blocked", error: "that time didn't read ... pick it again." };
    }
    // Set synchronously ... two clicks before React renders must not send twice.
    active = true;
    const operation = new AbortController();
    controller = operation;
    let edits = 0;
    let sent = false;
    const onEdit = () => { edits += 1; };
    options.target.addEventListener("nova:piece-edited", onEdit);
    removeListener = () => options.target.removeEventListener("nova:piece-edited", onEdit);

    try {
      if (intent.kind !== "cancel") {
        options.onPhase?.("saving");
        await options.flush(operation.signal);
        if (closed) return { status: "closed" };
        if (edits > 0) {
          return { status: "blocked", error: "the page changed while saving. nothing was sent ... review your words, then try again." };
        }
      }
      // Cancellation is a walk-back and must not depend on a healthy save.
      options.onPhase?.("sending");
      if (closed) return { status: "closed" };
      if (intent.kind !== "cancel" && edits > 0) {
        return { status: "blocked", error: "the page changed before sending. nothing was sent ... review your words, then try again." };
      }
      const editsAtSend = edits;
      sent = true;
      // No retry and no pretend cancellation of an already-sent server action.
      const reply = record(await action());
      if (closed) return { status: "closed" };
      if (reply?.ok === false && typeof reply.error === "string" && reply.error.trim()) {
        return { status: "rejected", error: reply.error };
      }
      const receipt = reply && readReceipt(intent, reply);
      if (!receipt) {
        uncertain = true;
        return { status: "unconfirmed", error: UNCONFIRMED };
      }
      return { status: "confirmed", receipt, editedWhileSending: edits !== editsAtSend };
    } catch {
      if (closed) return { status: "closed" };
      if (sent) {
        uncertain = true;
        return { status: "unconfirmed", error: UNCONFIRMED };
      }
      return { status: "blocked", error: "the draft save is not confirmed. nothing was sent ... keep this page open and try saving again." };
    } finally {
      removeListener?.();
      removeListener = null;
      operation.abort();
      controller = null;
      active = false;
      if (!closed) options.onPhase?.(null);
    }
  }

  return {
    run,
    busy: () => active,
    dispose: () => {
      closed = true;
      removeListener?.();
      removeListener = null;
      controller?.abort();
    },
  };
}
