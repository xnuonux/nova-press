# the manuscript desk

2026-09-25 ... feature slice stacked on release-safety pr #3 at
`ea543a5d297450048e929130e55c9b2a021c227d`. draft source, not a deployment.

## what is built

one closed-by-default desk inside the existing plate provider. the original page
and its editor tree stay mounted. a stable title reader supplies the live title.
opening the desk does not call a model, save, publish or access a database.

- a heading outline and literal passage search, including across inline marks.
  selection uses the existing editor. it rechecks exact source before navigating;
  a stale map refreshes instead of selecting an unrelated passage. no replacement.
- named session checkpoints, frozen and owner-piece scoped in memory. 12 slots,
  8 mib total, no silent eviction. duplicate source does not consume another slot.
  the interface warns that refresh or navigation discards them. beforeunload is a
  best-effort warning, not persistence or a reliable mobile lifecycle guarantee.
- side-by-side comparisons against a selected checkpoint. linear changed-block
  windows, title changes and formatting-only changes are described, not scored.
  comparisons are not minimal diffs. previews cap at 12,000 characters explicitly.
- exact rich json draft downloads, including unsaved edits and unknown json keys;
  plain text downloads; and a pinned private text-first html reading proof.
  downloads report requested, not saved-to-disk. json has a version and explicit
  local custody label. there is no automatic restore, import or manuscript apply.
- a sandboxed proof with explicit refresh and matching html download. text and
  headings are escaped; no scripts, remote images or live links are included.
  verse lines and literal whitespace remain. print css is included. inline marks,
  links, media and complex layouts are not reconstructed; json retains the source.

## boundaries that matter

this is session comparison, not durable revision history, encrypted storage,
cloud backup, collaboration or cross-tab merge. a source token is exact local
json, not a server revision, signature or proof of authorship. exporting a local
draft does not confirm the autosave or publish that draft.

the reader refuses non-json values, cycles, getters, sparse arrays, ambiguous
objects, excessive depth and drafts above 2 mib instead of dropping data. failure
preserves the last readable map and pauses navigation. unsupported text blocks
are explicitly reported. search reads within a block, not across blocks, returns
at most 200 matches with an overflow notice, and uses javascript unicode simple
case matching rather than full language-specific case folding. outline display
caps at 100 headings with a notice; source exports do not truncate.

existing save, review and release transports are untouched. the desk is not the
work-level binder, codex, voice room or native lunari adapter. it does not add pdf,
epub or docx rendering; those existing work-export paths are unchanged.

## actual validation

139 focused node tests passed: the 73 new desk cases and 66 prior save/release
cases. tests execute the actual typescript modules. one test runs 400 generated
mixed-leaf documents; these are not counted as 400 extra tests. strict typescript
checking passed for the two new pure helpers. changed tsx passed syntax
transpilation, not a full application typecheck.

51 chromium checks passed on the actual generated html proof at 390, 768 and 1440
pixels, with synthetic manuscript content. they cover text/verse, custody copy,
escaping, no injected elements or network requests, long headings, overflow and
print styles. the long-heading check caught an overflow and the source was fixed.
these are artifact-rendering checks, not a rendered react or plate integration.

run in a dependency-enabled checkout:

```sh
node --test scripts/verify-save-safety.mjs scripts/verify-release-safety.mjs scripts/verify-manuscript-desk.mjs
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## before merge

the vm could not resolve package-download hosts. the full react 19 / plate 49
application suite, lint, build, authenticated editor and historical 801-test suite
were not run. no react 16 fixture substitutes for this gate.

mount the real editor under strict mode. test current title/body reads, nested
marked search, stale maps, unchanged editor identity, selection history, focus
mode, hidden keyboard order, mobile scrolling, checkpoint close/reopen/removal,
page switches, read failures, blocked downloads, beforeunload, iframe sandbox and
url cleanup. confirm every existing save/review/release regression remains green.
no migration, provider key, workflow, merge, publication or deployment is included.
