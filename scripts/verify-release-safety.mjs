// node --test scripts/verify-release-safety.mjs
// Runs the actual TypeScript helpers, not a second implementation of them.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function load(name) {
  const source = await readFile(new URL(`../src/lib/editor/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { createReleaseGate } = await load("release-gate");
const { requestSaveFlush } = await load("save-handshake");
const { createSaveQueue } = await load("save-queue");
const tick = () => new Promise(setImmediate);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const publish = { kind: "publish" };
const whenIso = "2099-01-01T12:00:00.000Z";
const schedule = { kind: "schedule", whenIso };
const cancel = { kind: "cancel" };
const published = { ok: true, slug: "our-page", url: "/p/our-page" };
const scheduled = { ok: true, scheduledAt: whenIso };
const ack = (target, requestId, ok, error) => target.dispatchEvent(
  new CustomEvent("nova:save-flushed", { detail: { requestId, ok, error } }),
);
const edited = (target) => target.dispatchEvent(new Event("nova:piece-edited"));
function fixture(overrides = {}) {
  const target = new EventTarget();
  const phases = [];
  const gate = createReleaseGate({ target, flush: async () => {}, onPhase: (p) => phases.push(p), ...overrides });
  return { gate, target, phases };
}

for (const [intent, receipt] of [[publish, published], [schedule, scheduled]]) {
  test(`${intent.kind} waits for save confirmation before sending`, async () => {
    const save = deferred(); let sent = 0;
    const { gate, phases } = fixture({ flush: () => save.promise });
    const result = gate.run(intent, async () => { sent++; return receipt; });
    await tick(); assert.equal(sent, 0); assert.equal(gate.busy(), true);
    assert.deepEqual(phases, ["saving"]);
    save.resolve(); assert.equal((await result).status, "confirmed");
    assert.equal(sent, 1); assert.equal(gate.busy(), false);
    assert.deepEqual(phases, ["saving", "sending", null]);
  });
  test(`${intent.kind} does not run when saving rejects`, async () => {
    let sent = 0;
    const { gate } = fixture({ flush: async () => { throw new Error("offline"); } });
    const result = await gate.run(intent, async () => { sent++; return receipt; });
    assert.equal(result.status, "blocked"); assert.equal(sent, 0); assert.equal(gate.busy(), false);
  });
  test(`${intent.kind} requires another deliberate click if the page changes during saving`, async () => {
    const save = deferred(); let sent = 0;
    const { gate, target } = fixture({ flush: () => save.promise });
    const result = gate.run(intent, async () => { sent++; return receipt; });
    edited(target); save.resolve();
    assert.equal((await result).status, "blocked"); assert.equal(sent, 0);
    assert.equal((await gate.run(intent, async () => { sent++; return receipt; })).status, "confirmed");
    assert.equal(sent, 1);
  });
}

test("a schedule walk-back works even when the draft cannot be saved", async () => {
  let saves = 0;
  const { gate, phases } = fixture({ flush: async () => { saves++; throw new Error("offline"); } });
  const result = await gate.run(cancel, async () => ({ ok: true, scheduledAt: null }));
  assert.equal(result.status, "confirmed"); assert.deepEqual(result.receipt, { kind: "cancel" });
  assert.equal(saves, 0); assert.deepEqual(phases, ["sending", null]);
});
test("same-tick duplicate clicks do not enqueue a second publish", async () => {
  const save = deferred(); let sent = 0;
  const { gate } = fixture({ flush: () => save.promise });
  const action = async () => { sent++; return published; };
  const first = gate.run(publish, action);
  assert.equal((await gate.run(publish, action)).status, "busy");
  save.resolve(); await first; assert.equal(sent, 1);
});
test("publish, schedule and cancel share the in-flight lock", async () => {
  const response = deferred(); let others = 0;
  const { gate } = fixture();
  const first = gate.run(publish, () => response.promise); await tick();
  for (const intent of [publish, schedule, cancel]) {
    assert.equal((await gate.run(intent, async () => { others++; })).status, "busy");
  }
  assert.equal(others, 0); response.resolve(published); await first;
});
test("a server-reported failure is surfaced without inventing a receipt", async () => {
  const { gate } = fixture();
  const result = await gate.run(publish, async () => ({ ok: false, error: "you're not signed in" }));
  assert.equal(result.status, "rejected"); assert.match(result.error, /not signed in/);
  assert.equal("receipt" in result, false); assert.equal(gate.busy(), false);
});
test("a failed save can be retried without another edit, never automatically", async () => {
  let saves = 0, sends = 0;
  const { gate } = fixture({ flush: async () => { if (++saves === 1) throw new Error("offline"); } });
  const action = async () => { sends++; return published; };
  assert.equal((await gate.run(publish, action)).status, "blocked");
  await tick(); assert.equal(sends, 0); assert.equal(saves, 1);
  assert.equal((await gate.run(publish, action)).status, "confirmed"); assert.equal(sends, 1);
});
for (const action of [() => { throw new Error("sync"); }, async () => { throw new Error("network"); }]) {
  test("a thrown release has an unknown outcome and is not sent again by this gate", async () => {
    const { gate } = fixture(); let resent = 0;
    const result = await gate.run(publish, action);
    assert.equal(result.status, "unconfirmed"); assert.equal(gate.busy(), false);
    assert.equal((await gate.run(publish, async () => { resent++; return published; })).status, "unconfirmed");
    assert.equal(resent, 0);
  });
}
for (const invalid of [null, {}, { ok: "true", slug: "our-page", url: "/p/our-page" },
  { ok: true, slug: "our-page", url: "https://other.test/p/our-page" },
  { ok: true, slug: "other-page", url: "/p/our-page" },
  { ok: true, slug: "../page", url: "/p/../page" }, { ok: false }]) {
  test(`malformed publish response is unconfirmed: ${JSON.stringify(invalid)}`, async () => {
    const { gate } = fixture();
    const result = await gate.run(publish, async () => invalid);
    assert.equal(result.status, "unconfirmed"); assert.equal("receipt" in result, false);
  });
}
for (const invalid of [null, "bad date", "2099-01-02T12:00:00.000Z"]) {
  test(`scheduling requires a matching timestamp, not ${JSON.stringify(invalid)}`, async () => {
    const { gate } = fixture();
    assert.equal((await gate.run(schedule, async () => ({ ok: true, scheduledAt: invalid }))).status, "unconfirmed");
  });
}
test("equivalent timestamp offsets are accepted as the same scheduled instant", async () => {
  const { gate } = fixture();
  const result = await gate.run(schedule, async () => ({ ok: true, scheduledAt: "2099-01-01T07:00:00-05:00" }));
  assert.equal(result.status, "confirmed"); assert.equal(result.receipt.scheduledAt, whenIso);
});
test("an invalid schedule input is rejected before saving or sending", async () => {
  let calls = 0;
  const { gate } = fixture({ flush: async () => { calls++; } });
  const result = await gate.run({ kind: "schedule", whenIso: "invalid" }, async () => { calls++; });
  assert.equal(result.status, "blocked"); assert.equal(calls, 0);
});
test("cancel must confirm null, not another scheduled date", async () => {
  const { gate } = fixture();
  assert.equal((await gate.run(cancel, async () => scheduled)).status, "unconfirmed");
});
test("edits during a sent publication do not pretend that the new draft was published", async () => {
  const response = deferred(); const { gate, target } = fixture();
  const result = gate.run(publish, () => response.promise); await tick(); edited(target);
  response.resolve(published); const done = await result;
  assert.equal(done.status, "confirmed"); assert.equal(done.editedWhileSending, true);
  assert.deepEqual(done.receipt, { kind: "publish", slug: "our-page", url: "/p/our-page" });
});
test("disposing during preflight prevents publication even if the flush ignores abort", async () => {
  const save = deferred(); let sent = 0;
  const { gate } = fixture({ flush: () => save.promise });
  const result = gate.run(publish, async () => { sent++; return published; });
  gate.dispose(); save.resolve(); assert.equal((await result).status, "closed"); assert.equal(sent, 0);
  assert.equal((await gate.run(publish, async () => published)).status, "closed");
});
test("disposing after send suppresses late UI results without claiming remote cancellation", async () => {
  const response = deferred(); let sent = 0;
  const { gate, phases } = fixture();
  const result = gate.run(publish, () => { sent++; return response.promise; }); await tick();
  gate.dispose(); const prior = [...phases]; response.resolve(published);
  assert.equal((await result).status, "closed"); assert.equal(sent, 1); assert.deepEqual(phases, prior);
});

test("the real handshake ignores another request's acknowledgement", async () => {
  const target = new EventTarget(); let requested, sent = 0;
  target.addEventListener("nova:flush-save", (e) => { requested = e.detail.requestId; });
  const gate = createReleaseGate({ target, flush: (signal) => requestSaveFlush(target, "release-1", { signal }) });
  const result = gate.run(publish, async () => { sent++; return published; });
  ack(target, "another-request", true); await tick(); assert.equal(sent, 0);
  assert.equal(requested, "release-1"); ack(target, requested, true);
  assert.equal((await result).status, "confirmed"); assert.equal(sent, 1);
});
test("a timeout and a late save acknowledgement never release the piece", async () => {
  const target = new EventTarget(); let sent = 0;
  const gate = createReleaseGate({ target, flush: (signal) => requestSaveFlush(target, "timed", { signal, timeoutMs: 5 }) });
  const result = await gate.run(publish, async () => { sent++; return published; });
  assert.equal(result.status, "blocked"); ack(target, "timed", true); await tick(); assert.equal(sent, 0);
});
test("a real failed acknowledgement blocks publication and keeps its error out of the manuscript", async () => {
  const target = new EventTarget(); let sent = 0;
  target.addEventListener("nova:flush-save", (e) => ack(target, e.detail.requestId, false, "offline"));
  const gate = createReleaseGate({ target, flush: (signal) => requestSaveFlush(target, "failed", { signal }) });
  assert.equal((await gate.run(publish, async () => { sent++; return published; })).status, "blocked");
  assert.equal(sent, 0);
});
test("disposing aborts the real handshake promptly, without waiting for its timer", async () => {
  const target = new EventTarget(); let signalUsed;
  const gate = createReleaseGate({ target, flush: (signal) => {
    signalUsed = signal; return requestSaveFlush(target, "closed", { signal, timeoutMs: 60000 });
  } });
  const result = gate.run(publish, async () => published); gate.dispose();
  assert.equal(signalUsed.aborted, true); assert.equal((await result).status, "closed");
});
test("actual queue, acknowledgement and release gate publish only after persistence", async () => {
  const target = new EventTarget(), save = deferred(); let persisted = false, sent = 0;
  const queue = createSaveQueue({ save: async () => { await save.promise; persisted = true; } });
  queue.markDirty();
  target.addEventListener("nova:flush-save", async (e) => {
    try { await queue.flush(); ack(target, e.detail.requestId, true); }
    catch { ack(target, e.detail.requestId, false); }
  });
  const gate = createReleaseGate({ target, flush: (signal) => requestSaveFlush(target, "integrated", { signal }) });
  const result = gate.run(publish, async () => { assert.equal(persisted, true); sent++; return published; });
  await tick(); assert.equal(sent, 0); save.resolve();
  assert.equal((await result).status, "confirmed"); assert.equal(queue.inspect().dirty, false); assert.equal(sent, 1);
});

test("listeners are removed after success, refusal, unknown response and disposal", async () => {
  class TrackedTarget extends EventTarget {
    edits = new Set();
    addEventListener(type, listener, options) {
      if (type === "nova:piece-edited") this.edits.add(listener);
      super.addEventListener(type, listener, options);
    }
    removeEventListener(type, listener, options) {
      if (type === "nova:piece-edited") this.edits.delete(listener);
      super.removeEventListener(type, listener, options);
    }
  }
  for (const reply of [published, { ok: false, error: "denied" }, null]) {
    const target = new TrackedTarget();
    const gate = createReleaseGate({ target, flush: async () => {} });
    await gate.run(publish, async () => reply); assert.equal(target.edits.size, 0);
  }
  const target = new TrackedTarget(), response = deferred();
  const gate = createReleaseGate({ target, flush: async () => {} });
  const result = gate.run(publish, () => response.promise); await tick();
  assert.equal(target.edits.size, 1); gate.dispose(); assert.equal(target.edits.size, 0);
  response.resolve(published); await result;
});
test("an edit at the sending boundary still prevents dispatch", async () => {
  const target = new EventTarget(); let sent = 0;
  const gate = createReleaseGate({ target, flush: async () => {}, onPhase: (phase) => {
    if (phase === "sending") edited(target);
  } });
  assert.equal((await gate.run(publish, async () => { sent++; return published; })).status, "blocked");
  assert.equal(sent, 0);
});
test("real save failure leaves the queue dirty and never calls the release action", async () => {
  const target = new EventTarget(); let sent = 0;
  const queue = createSaveQueue({ save: async () => { throw new Error("offline"); } });
  queue.markDirty();
  target.addEventListener("nova:flush-save", async (e) => {
    try { await queue.flush(); ack(target, e.detail.requestId, true); }
    catch { ack(target, e.detail.requestId, false, "offline"); }
  });
  const gate = createReleaseGate({ target, flush: (signal) => requestSaveFlush(target, "queue-failure", { signal }) });
  assert.equal((await gate.run(publish, async () => { sent++; return published; })).status, "blocked");
  assert.equal(queue.inspect().dirty, true); assert.equal(sent, 0);
});
test("draining newer edits saves the draft but does not silently change release consent", async () => {
  const target = new EventTarget(), first = deferred(), second = deferred(); let writes = 0, sent = 0;
  const queue = createSaveQueue({ save: () => ++writes === 1 ? first.promise : second.promise });
  queue.markDirty();
  target.addEventListener("nova:flush-save", async (e) => {
    await queue.flush(); ack(target, e.detail.requestId, true);
  });
  const gate = createReleaseGate({ target, flush: (signal) => requestSaveFlush(target, "newer-edit", { signal }) });
  const result = gate.run(publish, async () => { sent++; return published; }); await tick();
  queue.markDirty(); edited(target); first.resolve(); await tick();
  assert.equal(writes, 2); assert.equal(sent, 0); second.resolve();
  assert.equal((await result).status, "blocked"); assert.equal(queue.inspect().dirty, false);
});
test("a replacement gate is usable after an effect cleanup and has no inherited lock", async () => {
  const old = fixture(), fresh = fixture(); old.gate.dispose();
  assert.equal((await old.gate.run(publish, async () => published)).status, "closed");
  assert.equal((await fresh.gate.run(publish, async () => published)).status, "confirmed");
});
