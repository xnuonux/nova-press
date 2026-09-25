/** serial saves for one mounted editor. a flush is an acknowledgement, not a timer. */
export type SaveState = "idle" | "saving" | "saved" | "error";

export interface SaveQueueOptions {
  save: () => Promise<void>;
  onState?: (state: SaveState) => void;
  onSaved?: () => void;
}

export function createSaveQueue({ save, onState, onSaved }: SaveQueueOptions) {
  let revision = 0;
  let savedRevision = 0;
  let flight: Promise<void> | null = null;
  let disposed = false;

  function assertOpen() {
    if (disposed) throw new Error("the writing room closed before the save was confirmed.");
  }

  function markDirty() {
    assertOpen();
    revision += 1;
    onState?.("saving");
  }

  function writeOne(): Promise<void> {
    if (flight) return flight;
    const writingRevision = revision;
    onState?.("saving");
    // enter through a promise so a synchronous transport failure has the same
    // failure path as an asynchronous one. there is only ever one write in flight.
    flight = Promise.resolve()
      .then(() => {
        assertOpen();
        return save();
      })
      .then(() => {
        assertOpen();
        savedRevision = writingRevision;
        onSaved?.();
        onState?.(savedRevision === revision ? "saved" : "saving");
      })
      .catch((error: unknown) => {
        if (!disposed) onState?.("error");
        throw error;
      })
      .finally(() => {
        flight = null;
      });
    return flight;
  }

  async function flush(): Promise<void> {
    assertOpen();
    // another edit can arrive while a write is pending. drain that revision too;
    // neither an old acknowledgement nor another caller may declare it saved.
    while (savedRevision < revision) {
      await writeOne();
      assertOpen();
    }
  }

  return {
    markDirty,
    flush,
    inspect: () => ({ revision, savedRevision, dirty: revision !== savedRevision, inFlight: flight !== null }),
    // a transport already sent cannot be recalled. suppress its callbacks and
    // prohibit follow-up writes after unmount; never claim it was cancelled remotely.
    dispose: () => { disposed = true; },
  };
}
