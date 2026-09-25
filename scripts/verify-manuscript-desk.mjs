import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const temp = mkdtempSync(join(tmpdir(), "nova-desk-"));
after(() => rmSync(temp, { recursive: true, force: true }));
for (const name of ["manuscript-desk", "draft-export"]) {
  const source = readFileSync(new URL(`../src/lib/editor/${name}.ts`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  writeFileSync(join(temp, `${name}.mjs`), js.replace('"./manuscript-desk"', '"./manuscript-desk.mjs"'));
}
const { captureDraft, indexDraft, draftText, outline, findPassages, createCheckpoints, compareDrafts, MAX_DRAFT_BYTES } = await import(pathToFileURL(join(temp, "manuscript-desk.mjs")));
const { exportDraft, readingProof, draftFilename } = await import(pathToFileURL(join(temp, "draft-export.mjs")));
const p = (text, extra = {}) => ({ type: "p", children: [{ text }], ...extra });
const draft = (body = [p("first light")], title = "the room", pieceId = "piece-a") => captureDraft(pieceId, title, body);
const stamp = "2026-09-25T12:00:00.000Z";

for (const [name, body] of [
  ["empty page", []], ["ordinary prose", [p("hello")]],
  ["whitespace and punctuation", [p("  hello\t‘world’...\n\nnext\r\n")]],
  ["unicode", [p("Żółć 🙂 東京 e\u0301")]],
  ["unknown blocks and marks", [p("line", { type: "future_block", metadata: { secret: false, number: 42 }, strangeMark: "yes" })]],
  ["special keys", JSON.parse('[{"type":"p","__proto__":{"polluted":true},"constructor":"kept","children":[{"text":"x"}]}]')],
]) test(`capture preserves ${name}`, () => {
  const input = structuredClone(body);
  const captured = draft(input);
  assert.deepEqual(JSON.parse(captured.source).body, body);
  assert.deepEqual(JSON.parse(exportDraft(captured, "json", stamp).content).body, body);
  assert.equal(Object.prototype.polluted, undefined);
});

test("snapshots are deeply frozen and detached from the editor", () => {
  const body = [p("before")];
  const captured = draft(body);
  body[0].children[0].text = "after";
  assert.equal(draftText(captured), "before");
  assert.throws(() => { captured.body[0].children[0].text = "tampered"; }, TypeError);
  assert.ok(Object.isFrozen(captured));
});
test("shared references are copied without being mistaken for cycles", () => {
  const node = p("twice");
  assert.equal(draftText(draft([node, node])), "twice\n\ntwice");
});
for (const [name, value] of [
  ["undefined", undefined], ["function", () => {}], ["bigint", 1n],
  ["nan", NaN], ["infinity", Infinity], ["negative zero", -0], ["date object", new Date()],
]) test(`non-json ${name} is rejected, never silently dropped`, () => assert.throws(() => draft([p("x", { extra: value })])));
test("cycles are rejected", () => {
  const root = p("x"); root.extra = root;
  assert.throws(() => draft([root]), /cycle/);
});
test("accessors are rejected without executing them", () => {
  let calls = 0;
  const root = p("x");
  Object.defineProperty(root, "danger", { enumerable: true, get() { calls++; return "unsafe"; } });
  assert.throws(() => draft([root]), /accessor/);
  assert.equal(calls, 0);
});
test("tojson is not executed", () => {
  let calls = 0;
  assert.throws(() => draft([p("x", { toJSON() { calls++; return null; } })]));
  assert.equal(calls, 0);
});
test("symbol and non-enumerable data are rejected", () => {
  const symbol = p("x"); symbol[Symbol("kept")] = 1;
  const hidden = p("x"); Object.defineProperty(hidden, "hidden", { value: 1 });
  assert.throws(() => draft([symbol]), /symbol/);
  assert.throws(() => draft([hidden]), /hidden/);
});
test("sparse and custom-property arrays are rejected", () => {
  assert.throws(() => draft(new Array(2)), /irregular/);
  const body = [p("x")]; body.extra = true;
  assert.throws(() => draft(body), /irregular/);
});
for (const body of [null, {}, "text", [null], ["plain"]]) test(`invalid root ${JSON.stringify(body)} is rejected`, () => assert.throws(() => draft(body)));
test("invalid identity and title cannot produce a snapshot", () => {
  for (const id of ["", 42, null, "x".repeat(201)]) assert.throws(() => draft([], "title", id));
  for (const title of [null, 42, "x".repeat(20_001)]) assert.throws(() => draft([], title));
});
test("byte budget measures unicode bytes, not just string length", () => {
  assert.throws(() => draft([p("é".repeat(MAX_DRAFT_BYTES / 2))]), /large/);
});
test("large ascii, depth and node budgets fail closed", () => {
  assert.throws(() => draft([p("x".repeat(MAX_DRAFT_BYTES))]), /large/);
  let deep = { text: "x" }; for (let i = 0; i < 66; i++) deep = { children: [deep] };
  assert.throws(() => draft([deep]), /complex/);
  assert.throws(() => draft(Array.from({ length: 40_001 }, () => p(""))), /complex/);
});
test("unchanged data has the same local source token; title and formatting count", () => {
  assert.equal(draft().source, draft().source);
  assert.notEqual(draft().source, draft(undefined, "new title").source);
  assert.notEqual(draft().source, draft([p("first light", { bold: true })]).source);
});
test("plain text keeps verse lines and empty stanzas", () => {
  assert.equal(draftText(draft([p("north", { type: "verse_line" }), p("", { type: "verse_line" }), p("south", { type: "verse_line" }), p("prose")])), "north\n\nsouth\n\nprose");
});
test("outline includes levels and nested inline text without mutating the source", () => {
  const d = draft([{ type: "h2", children: [{ text: "the " }, { type: "a", children: [{ text: "sea" }] }] }, p("body"), p("", { type: "h3" })]);
  assert.deepEqual(outline(d).map((x) => [x.title, x.level, x.blockIndex]), [["the sea", 2, 0], ["", 3, 2]]);
  assert.deepEqual(outline(d)[0].point, { path: [0, 0], offset: 0 });
});
test("unreadable blocks are identified, not treated as valid empty prose", () => {
  const d = draft([{ type: "future", payload: "kept" }]);
  assert.equal(indexDraft(d)[0].readable, false);
  assert.equal(JSON.parse(exportDraft(d, "json", stamp).content).body[0].payload, "kept");
});
test("search crosses marks and inline elements with exact slate paths", () => {
  const d = draft([{ type: "p", children: [{ text: "he", bold: true }, { type: "a", children: [{ text: "llo" }] }] }]);
  assert.deepEqual(findPassages(d, "ell").matches[0].range, { anchor: { path: [0, 0], offset: 1 }, focus: { path: [0, 1, 0], offset: 2 } });
});
test("search respects boundaries, zero-length leaves and surrogate offsets", () => {
  const d = draft([{ type: "p", children: [{ text: "" }, { text: "🙂sea" }, { text: "shore" }] }]);
  const hit = findPassages(d, "seashore").matches[0];
  assert.deepEqual(hit.range, { anchor: { path: [0, 1], offset: 2 }, focus: { path: [0, 2], offset: 5 } });
});
for (const query of ["[", "]", ".*", "$", "^", "(x)", "a+b", "\\", "?", "{2}", "a|b"]) test(`search treats ${JSON.stringify(query)} literally`, () => {
  const hits = findPassages(draft([p(`before ${query} after`)]), query).matches;
  assert.equal(hits.length, 1);
  assert.equal(hits[0].start, 7);
});
test("case switch uses original offsets even with unicode case variants", () => {
  const d = draft([p("Sea SEA sea ſea")]);
  assert.equal(findPassages(d, "sea").matches.length, 4);
  assert.equal(findPassages(d, "sea", true).matches.length, 1);
});
test("matches never span distinct blocks", () => assert.equal(findPassages(draft([p("sea"), p("shore")]), "seashore").matches.length, 0));
test("empty search, no match and query limits are explicit", () => {
  assert.equal(findPassages(draft(), "").matches.length, 0);
  assert.equal(findPassages(draft(), "missing").matches.length, 0);
  assert.throws(() => findPassages(draft(), "x".repeat(257)), /256/);
});
test("result cap distinguishes exactly 200 from additional matches", () => {
  assert.equal(findPassages(draft([p("x ".repeat(200))]), "x").more, false);
  const result = findPassages(draft([p("x ".repeat(201))]), "x");
  assert.equal(result.matches.length, 200); assert.equal(result.more, true);
});
test("checkpoint shelf isolates pieces and immutable snapshots", () => {
  const shelf = createCheckpoints("piece-a");
  const entry = shelf.keep(draft(), "before", stamp);
  assert.equal(shelf.list()[0], entry);
  assert.ok(Object.isFrozen(shelf.list()));
  assert.throws(() => shelf.keep(draft([], "x", "piece-b"), "foreign", stamp), /another/);
});
test("duplicate checkpoints do not silently consume slots or replace labels", () => {
  const shelf = createCheckpoints("piece-a");
  const first = shelf.keep(draft(), "first", stamp);
  assert.equal(shelf.keep(draft(), "second", stamp), first);
  assert.equal(shelf.list().length, 1); assert.equal(first.label, "first");
});
test("checkpoint cap preserves all earlier entries and removal is deliberate", () => {
  const shelf = createCheckpoints("piece-a");
  for (let i = 0; i < 12; i++) shelf.keep(draft([p(String(i))]), `point ${i}`, stamp);
  const before = shelf.list();
  assert.throws(() => shelf.keep(draft([p("13")]), "overflow", stamp), /full/);
  assert.equal(shelf.list(), before);
  shelf.remove(before[0].id); assert.equal(shelf.list().length, 11);
  shelf.keep(draft([p("13")]), "fits now", stamp); assert.equal(shelf.list().length, 12);
});
test("checkpoint byte cap never evicts an older draft", () => {
  const shelf = createCheckpoints("piece-a");
  for (let i = 0; i < 5; i++) shelf.keep(draft([p("x".repeat(1_500_000) + i)]), `point ${i}`, stamp);
  assert.throws(() => shelf.keep(draft([p("y".repeat(1_500_000))]), "full", stamp), /full/);
  assert.equal(shelf.list().length, 5);
});
test("checkpoint labels and dates are validated", () => {
  const shelf = createCheckpoints("piece-a");
  assert.throws(() => shelf.keep(draft(), " ", stamp));
  assert.throws(() => shelf.keep(draft(), "x".repeat(81), stamp));
  assert.throws(() => shelf.keep(draft(), "point", "invalid"));
});
test("comparison finds a bounded changed window while retaining the common suffix", () => {
  const before = draft([p("a"), p("b"), p("c")]);
  const after = draft([p("a"), p("new"), p("extra"), p("c")]);
  const result = compareDrafts(before, after);
  assert.equal(result.start, 1); assert.equal(result.beforeEnd, 2); assert.equal(result.afterEnd, 3);
  assert.equal(result.beforeText, "b"); assert.equal(result.afterText, "new\n\nextra"); assert.equal(result.blockDelta, 1);
});
test("comparison distinguishes title-only, format-only and identical changes", () => {
  assert.equal(compareDrafts(draft(), draft()).identical, true);
  const title = compareDrafts(draft(), draft(undefined, "other"));
  assert.equal(title.titleChanged, true); assert.equal(title.bodyChanged, false);
  const format = compareDrafts(draft(), draft([p("first light", { metadata: 1 })]));
  assert.equal(format.formattingOnly, true); assert.equal(format.bodyChanged, true);
});
test("comparison handles insertion, deletion, empty documents and foreign scope", () => {
  assert.equal(compareDrafts(draft([]), draft()).blockDelta, 1);
  assert.equal(compareDrafts(draft(), draft([])).blockDelta, -1);
  assert.equal(compareDrafts(draft([]), draft([])).identical, true);
  assert.throws(() => compareDrafts(draft(), draft([], "x", "other")), /same piece/);
});
test("json download records local custody without claiming server persistence", () => {
  const value = JSON.parse(exportDraft(draft(), "json", stamp).content);
  assert.equal(value.version, 1); assert.equal(value.format, "nova-press-draft");
  assert.equal(value.capturedAt, stamp); assert.match(value.custody, /not attested/);
});
test("text export keeps title and text punctuation without normalizing the manuscript", () => {
  const d = draft([p("  “north”...\n\tsouth")], "Title!");
  assert.equal(exportDraft(d, "txt", stamp).content, "Title!\n\n  “north”...\n\tsouth");
});
test("proof escapes hostile title, block type and text; never emits external resources", () => {
  const d = draft([p('<script>alert("x")</script><img src=https://bad.test>', { type: 'h1 onclick="bad()"', url: "https://bad.test" })], '</title><script>alert(1)</script>');
  const html = readingProof(d);
  assert.ok(!html.includes("<script")); assert.ok(!html.includes("<img")); assert.ok(!html.includes('onclick="'));
  assert.match(html, /&lt;script&gt;/); assert.match(html, /default-src 'none'/);
  assert.match(html, /form-action 'none'/); assert.match(html, /text-first proof/);
});
test("proof retains headings, blank verse lines and print styling", () => {
  const html = readingProof(draft([p("heading", { type: "h2" }), p("", { type: "verse_line" }), p("next", { type: "verse_line" })]));
  assert.match(html, /<h2>heading<\/h2>/); assert.match(html, /class="verse"><br>/); assert.match(html, /@media print/);
});
test("proof discloses unreadable blocks and lossy formatting", () => {
  const html = readingProof(draft([{ type: "future", payload: "raw" }]));
  assert.match(html, /no readable text/); assert.match(html, /inline marks, links, media/);
});
for (const name of ["../../unsafe", "CON", "NUL.txt", "a/b\\c", 'evil<>:"|?*', "...", "", "lpt1"]) test(`filename ${JSON.stringify(name)} is safe`, () => {
  const filename = draftFilename(name);
  assert.ok(filename.length > 0); assert.ok(!/[<>:"/\\|?*\u0000-\u001f]/.test(filename));
  assert.ok(!/^\./.test(filename)); assert.ok(!/^(CON|NUL|LPT1)(?:\.|$)/i.test(filename));
});
test("filenames retain unicode and truncate without cutting surrogate pairs", () => {
  assert.equal(draftFilename("Żółć 東京"), "Żółć 東京");
  assert.equal(Array.from(draftFilename("🙂".repeat(100))).length, 64);
});
test("invalid export type and dates fail without writing anything", () => {
  assert.throws(() => exportDraft(draft(), "pdf", stamp), /unknown/);
  assert.throws(() => exportDraft(draft(), "json", "bad"), /date/);
});
test("seeded mixed-leaf search agrees with literal source in 400 generated documents", () => {
  let seed = 29;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let i = 0; i < 400; i++) {
    const text = Array.from({ length: 30 }, () => "abc🙂"[random() % 3]).join("");
    const split = random() % 20;
    const d = draft([{ type: "p", children: [{ text: text.slice(0, split) }, { type: "a", children: [{ text: text.slice(split) }] }] }]);
    for (const query of ["a", "ab", "bc", "cba"]) {
      const expected = [...text.matchAll(new RegExp(query, "g"))].map((m) => m.index);
      assert.deepEqual(findPassages(d, query, true).matches.map((m) => m.start), expected);
    }
  }
});
