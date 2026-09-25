// node --test scripts/verify-save-safety.mjs
// uses the repository's existing typescript dev dependency, not a rewritten model.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function load(relative) {
  const text = await readFile(new URL(relative, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { createSaveQueue } = await load("../src/lib/editor/save-queue.ts");
const { requestSaveFlush } = await load("../src/lib/editor/save-handshake.ts");
const { createReviewFreshness } = await load("../src/lib/editor/review-freshness.ts");
// custom events are native in the browser; accommodate earlier node 20 releases.
if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class extends Event {
    constructor(type, options = {}) { super(type, options); this.detail = options.detail; }
  };
}
const tick = () => new Promise(setImmediate);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const ack = (target, requestId, ok, error) => target.dispatchEvent(
  new CustomEvent("nova:save-flushed", { detail: { requestId, ok, error } }),
);

// the queue is shared by debounce saves and editorial flush requests.
test("opening a document and flushing an unchanged document do not write", async () => {
  let writes = 0;
  const queue = createSaveQueue({ save: async () => { writes += 1; } });
  await queue.flush(); await queue.flush();
  assert.equal(writes, 0);
  assert.deepEqual(queue.inspect(), { revision: 0, savedRevision: 0, dirty: false, inFlight: false });
});
test("several edits before a flush coalesce into one write", async () => {
  let writes = 0;
  const queue = createSaveQueue({ save: async () => { writes += 1; } });
  queue.markDirty(); queue.markDirty(); queue.markDirty();
  await queue.flush();
  assert.equal(writes, 1); assert.equal(queue.inspect().savedRevision, 3);
});
test("a flush during an in-flight save waits for the transport", async () => {
  const transport = deferred(); let confirmed = false;
  const queue = createSaveQueue({ save: () => transport.promise });
  queue.markDirty();
  const first = queue.flush(); await tick();
  const second = queue.flush().then(() => { confirmed = true; });
  await tick(); assert.equal(confirmed, false);
  transport.resolve(); await Promise.all([first, second]);
  assert.equal(confirmed, true);
});
test("concurrent flush requests share one write", async () => {
  const transport = deferred(); let writes = 0;
  const queue = createSaveQueue({ save: () => { writes += 1; return transport.promise; } });
  queue.markDirty();
  const requests = [queue.flush(), queue.flush(), queue.flush()];
  await tick(); assert.equal(writes, 1);
  transport.resolve(); await Promise.all(requests);
  assert.equal(writes, 1);
});
test("new edits during a write are drained serially, not marked saved by the old response", async () => {
  const first = deferred(), second = deferred(); let writes = 0;
  const states = [];
  const queue = createSaveQueue({
    save: () => (++writes === 1 ? first.promise : second.promise),
    onState: (state) => states.push(state),
  });
  queue.markDirty(); const result = queue.flush(); await tick();
  queue.markDirty(); assert.equal(writes, 1);
  first.resolve(); await tick();
  assert.equal(writes, 2); assert.equal(queue.inspect().dirty, true);
  assert.equal(states.includes("saved"), false);
  second.resolve(); await result;
  assert.equal(queue.inspect().dirty, false); assert.equal(states.at(-1), "saved");
});
test("simultaneous waiters and edits never overlap transports", async () => {
  let active = 0, maxActive = 0, writes = 0;
  const transport = deferred();
  const queue = createSaveQueue({ save: async () => {
    active += 1; maxActive = Math.max(maxActive, active); writes += 1;
    if (writes === 1) await transport.promise;
    active -= 1;
  }});
  queue.markDirty(); const first = queue.flush(); await tick();
  queue.markDirty(); const second = queue.flush();
  transport.resolve(); await Promise.all([first, second]);
  assert.equal(maxActive, 1); assert.equal(writes, 2);
});
test("a rejected save stays dirty and rejects the editorial flush", async () => {
  const queue = createSaveQueue({ save: async () => { throw new Error("offline"); } });
  queue.markDirty(); await assert.rejects(queue.flush(), /offline/);
  assert.equal(queue.inspect().dirty, true); assert.equal(queue.inspect().savedRevision, 0);
});
test("a failed save can be retried deliberately without another edit", async () => {
  let writes = 0;
  const queue = createSaveQueue({ save: async () => { if (++writes === 1) throw new Error("offline"); } });
  queue.markDirty(); await assert.rejects(queue.flush()); await queue.flush();
  assert.equal(writes, 2); assert.equal(queue.inspect().dirty, false);
});
test("a synchronous transport failure follows the same error path", async () => {
  const states = [];
  const queue = createSaveQueue({ save: () => { throw new Error("sync"); }, onState: (s) => states.push(s) });
  queue.markDirty(); await assert.rejects(queue.flush(), /sync/);
  assert.equal(states.at(-1), "error"); assert.equal(queue.inspect().dirty, true);
});
test("a clean follow-up flush does not change a saved document's watermark", async () => {
  let writes = 0;
  const queue = createSaveQueue({ save: async () => { writes += 1; } });
  queue.markDirty(); await queue.flush(); await queue.flush();
  assert.equal(writes, 1);
});
test("unmount suppresses late callbacks and rejects an unconfirmed flush", async () => {
  const transport = deferred(); const states = [];
  const queue = createSaveQueue({ save: () => transport.promise, onState: (s) => states.push(s) });
  queue.markDirty(); const result = queue.flush(); await tick();
  const rejected = assert.rejects(result, /closed/);
  queue.markDirty(); queue.dispose(); const prior = [...states];
  transport.resolve(); await rejected;
  assert.deepEqual(states, prior); await assert.rejects(queue.flush(), /closed/);
  assert.throws(() => queue.markDirty(), /closed/);
});
test("two separate mounted-document queues do not share revision or save state", async () => {
  let firstWrites = 0, secondWrites = 0;
  const first = createSaveQueue({ save: async () => { firstWrites++; } });
  const second = createSaveQueue({ save: async () => { secondWrites++; } });
  first.markDirty(); await second.flush();
  assert.equal(secondWrites, 0); assert.equal(first.inspect().dirty, true);
  await first.flush(); assert.equal(firstWrites, 1);
});

test("a correlated successful acknowledgement opens the gate", async () => {
  const target = new EventTarget();
  target.addEventListener("nova:flush-save", (e) => ack(target, e.detail.requestId, true));
  await requestSaveFlush(target, "one");
});
test("a failed acknowledgement prevents the editorial request", async () => {
  const target = new EventTarget(); let passes = 0;
  target.addEventListener("nova:flush-save", (e) => ack(target, e.detail.requestId, false, "offline"));
  await assert.rejects(requestSaveFlush(target, "one").then(() => passes++), /offline/);
  assert.equal(passes, 0);
});
test("an unrelated acknowledgement cannot release another request", async () => {
  const target = new EventTarget(); let done = false;
  const result = requestSaveFlush(target, "wanted").then(() => { done = true; });
  ack(target, "other", true); await tick(); assert.equal(done, false);
  ack(target, "wanted", true); await result; assert.equal(done, true);
});
test("an untyped legacy acknowledgement does not count as success", async () => {
  const target = new EventTarget();
  target.addEventListener("nova:flush-save", () => target.dispatchEvent(new CustomEvent("nova:save-flushed")));
  await assert.rejects(requestSaveFlush(target, "one", { timeoutMs: 15 }), /not confirmed/);
});
test("a timeout stops the pass instead of pretending the save succeeded", async () => {
  let passes = 0;
  await assert.rejects(requestSaveFlush(new EventTarget(), "one", { timeoutMs: 15 }).then(() => passes++), /not confirmed/);
  assert.equal(passes, 0);
});
test("aborting a wait removes its acknowledgement listener", async () => {
  class TrackingTarget extends EventTarget {
    listeners = new Set();
    addEventListener(type, cb, options) { if (type === "nova:save-flushed") this.listeners.add(cb); super.addEventListener(type, cb, options); }
    removeEventListener(type, cb, options) { if (type === "nova:save-flushed") this.listeners.delete(cb); super.removeEventListener(type, cb, options); }
  }
  const target = new TrackingTarget(), controller = new AbortController();
  const result = requestSaveFlush(target, "one", { signal: controller.signal });
  const rejected = assert.rejects(result, /cancelled/);
  controller.abort(); await rejected; assert.equal(target.listeners.size, 0);
});
test("a pre-aborted request does not ask the editor to save", async () => {
  const target = new EventTarget(), controller = new AbortController(); let requests = 0;
  target.addEventListener("nova:flush-save", () => requests++);
  controller.abort();
  await assert.rejects(requestSaveFlush(target, "one", { signal: controller.signal }), /cancelled/);
  assert.equal(requests, 0);
});
test("malformed or unsuccessful acknowledgements fail closed", async () => {
  const target = new EventTarget();
  target.addEventListener("nova:flush-save", (e) => ack(target, e.detail.requestId, "yes"));
  await assert.rejects(requestSaveFlush(target, "one"), /could not be saved/);
});
test("a timeout cannot be bypassed by a late successful response", async () => {
  const target = new EventTarget(); let passes = 0;
  await assert.rejects(requestSaveFlush(target, "one", { timeoutMs: 5 }).then(() => passes++));
  ack(target, "one", true); await tick(); assert.equal(passes, 0);
});
test("the real queue and handshake wait for every edit before allowing a pass", async () => {
  const target = new EventTarget(), first = deferred(), second = deferred(); let writes = 0, passes = 0;
  const queue = createSaveQueue({ save: () => (++writes === 1 ? first.promise : second.promise) });
  target.addEventListener("nova:flush-save", (e) => {
    void queue.flush().then(() => ack(target, e.detail.requestId, true), () => ack(target, e.detail.requestId, false));
  });
  queue.markDirty(); const result = requestSaveFlush(target, "pass").then(() => passes++);
  await tick(); queue.markDirty(); first.resolve(); await tick();
  assert.equal(passes, 0); second.resolve(); await result;
  assert.equal(passes, 1); assert.equal(writes, 2);
});

test("an unchanged review is both latest and current", () => {
  const clock = createReviewFreshness(), stamp = clock.begin();
  assert.equal(clock.isLatest(stamp), true); assert.equal(clock.isCurrent(stamp), true);
});
test("typing during a review prevents a late result from clearing staleness", () => {
  const clock = createReviewFreshness(), stamp = clock.begin(); clock.edited();
  assert.equal(clock.isLatest(stamp), true); assert.equal(clock.isCurrent(stamp), false);
});
test("a new review invalidates an older response even without another edit", () => {
  const clock = createReviewFreshness(), old = clock.begin(), latest = clock.begin();
  assert.equal(clock.isLatest(old), false); assert.equal(clock.isCurrent(latest), true);
});
test("unmount or stage changes invalidate the pending review", () => {
  const clock = createReviewFreshness(), stamp = clock.begin(); clock.invalidate();
  assert.equal(clock.isLatest(stamp), false); assert.equal(clock.isCurrent(stamp), false);
});
test("a new review can become current after an edit", () => {
  const clock = createReviewFreshness(); clock.begin(); clock.edited();
  const stamp = clock.begin(); assert.equal(clock.isCurrent(stamp), true);
});
