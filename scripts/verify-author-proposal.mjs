import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const temp = mkdtempSync(join(tmpdir(), "nova-proposal-"));
after(() => rmSync(temp, { recursive: true, force: true }));
for (const name of ["manuscript-desk", "author-proposal"]) {
  const source = readFileSync(new URL(`../src/lib/editor/${name}.ts`, import.meta.url), "utf8");
  writeFileSync(join(temp, `${name}.mjs`), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
}
const { captureDraft } = await import(pathToFileURL(join(temp, "manuscript-desk.mjs")));
const { createAuthorProposal, isProposalTask, MAX_AUTHOR_STREAM_CHARS } = await import(pathToFileURL(join(temp, "author-proposal.mjs")));
const p = (text) => ({ type: "p", children: [{ text }] });
const draft = (body = [p("the seed"), p("the ending")], title = "the room", id = "piece-a") => captureDraft(id, title, body);
const base = draft();
const ready = (task = "draft-beat", index = 0, lines = ["the new beat"]) => {
  const gate = createAuthorProposal(base, task, index);
  gate.finish(lines, base);
  return gate;
};

for (const task of ["expand", "draft-beat", "outline", "coin"]) test(`${task} needs completion and explicit acceptance`, () => {
  const gate = createAuthorProposal(base, task, 0);
  assert.equal(gate.state(), "streaming");
  assert.equal(gate.take(base).ok, false);
  assert.equal(gate.finish(["one offered line"], base), "ready");
  const result = gate.take(base);
  assert.equal(result.ok, true); assert.equal(result.at, 1);
  assert.equal(result.nodes[0].type, task === "coin" ? "verse_line" : "p");
  assert.equal(result.nodes[0].children[0].text, "one offered line");
  assert.equal(base.body[0].children[0].text, "the seed");
});
for (const index of [-1, 2, 99, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) test(`anchor ${index} is rejected instead of clamped`, () => assert.throws(() => createAuthorProposal(base, "expand", index)));
test("unknown tasks are rejected", () => {
  for (const task of ["rewrite-all", "__proto__", "", null, 42]) {
    assert.equal(isProposalTask(task), false);
    assert.throws(() => createAuthorProposal(base, task, 0));
  }
});
test("last-block insertion is after the anchor, not a replacement", () => assert.equal(ready("expand", 1).take(base).at, 2));
for (const [name, live] of [
  ["title edit", draft(undefined, "other title")],
  ["body edit", draft([p("edited seed"), p("the ending")])],
  ["new block before anchor", draft([p("new"), ...base.body])],
  ["removed block", draft([p("the seed")])],
  ["formatting edit", draft([{ ...p("the seed"), bold: true }, p("the ending")])],
  ["foreign piece", draft(undefined, "the room", "piece-b")],
]) test(`${name} blocks acceptance even without a change event`, () => {
  const gate = ready();
  assert.deepEqual(gate.take(live), { ok: false, reason: "stale" });
});
test("edits while streaming make the finished proposal stale", () => {
  const gate = createAuthorProposal(base, "expand", 0);
  const live = draft([p("changed")]);
  assert.equal(gate.observe(live), "stale");
  assert.equal(gate.finish(["new line"], live), "stale");
  assert.equal(gate.take(live).ok, false);
});
test("a completed response checks source even when no edit was observed", () => {
  const gate = createAuthorProposal(base, "expand", 0);
  assert.equal(gate.finish(["new line"], draft([], "new")), "stale");
});
test("observed staleness remains stale after undo returns to the original text", () => {
  const gate = ready();
  gate.observe(draft([p("temporary")]));
  assert.equal(gate.observe(base), "stale");
  assert.equal(gate.take(base).ok, false);
});
test("two synchronous accept attempts yield only one plan", () => {
  const gate = ready();
  assert.equal(gate.take(base).ok, true);
  assert.deepEqual(gate.take(base), { ok: false, reason: "consumed" });
});
test("a thrown or partially completed transform cannot reopen the proposal", () => {
  const gate = ready(); let attempts = 0;
  const apply = () => { const plan = gate.take(base); if (plan.ok) { attempts++; throw new Error("unknown outcome"); } };
  assert.throws(apply); apply();
  assert.equal(attempts, 1); assert.equal(gate.state(), "consumed");
});
test("outline lines are frozen at completion, not read from a mutable preview", () => {
  const lines = ["first", "second"];
  const gate = ready("outline", 0, lines);
  lines[0] = "tampered"; lines.push("extra");
  assert.deepEqual(gate.take(base).nodes.map((n) => n.children[0].text), ["first", "second"]);
});
for (const lines of [[], [""], [" "], ["x", "y"], [null], [42], ["x".repeat(MAX_AUTHOR_STREAM_CHARS + 1)]]) test(`invalid beat ${typeof lines[0]} length ${lines.length}:${String(lines[0]).length} is blocked`, () => {
  const gate = createAuthorProposal(base, "expand", 0);
  assert.equal(gate.finish(lines, base), "blocked");
  assert.equal(gate.take(base).ok, false);
});
test("outline count is bounded without silently truncating", () => {
  const gate = createAuthorProposal(base, "outline", 0);
  assert.equal(gate.finish(Array.from({ length: 33 }, () => "line"), base), "blocked");
});
test("a valid maximum outline remains intact", () => {
  const gate = ready("outline", 0, Array.from({ length: 32 }, (_, i) => `line ${i}`));
  assert.equal(gate.take(base).nodes.length, 32);
});
test("stream failure and dismissal are terminal", () => {
  const gate = ready(); gate.block(); assert.equal(gate.take(base).ok, false);
  gate.finish(["late"], base); assert.equal(gate.state(), "blocked");
  const other = ready(); other.dismiss();
  other.finish(["late"], base); assert.equal(other.take(base).reason, "dismissed");
});
test("late completion cannot replace a ready offer", () => {
  const gate = ready(); gate.finish(["different"], base);
  assert.equal(gate.take(base).nodes[0].children[0].text, "the new beat");
});
test("consumption stays terminal after dismissal, blocking and late response", () => {
  const gate = ready(); gate.take(base); gate.dismiss(); gate.block(); gate.finish(["late"], base);
  assert.equal(gate.state(), "consumed");
});
