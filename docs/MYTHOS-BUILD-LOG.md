# nova press · the mythos · build log

> the perfection-loop tracker. the autonomous build reads this each fire, does the next increment, verifies it, commits, updates this log, and schedules the next fire. north star: `docs/07-mythos-vision.md`. architecture: `docs/08-editorial-system-architecture.md`. branch: `feat/mythos-editorial-system`.

## the loop contract (every fire honors this)

1. read this log. pick the next unchecked increment.
2. build it (additive, mirror the existing seams, lunari voice ... lowercase, no em-dashes, `...` for pauses).
3. verify: `pnpm typecheck` + `pnpm test` green; em-dash sweep on new files = 0; for UI, `playwright` e2e + a screenshot read back to confirm it renders.
4. commit on the branch (conventional, no em-dashes in the message). never main.
5. update this log (check the box, note what shipped). schedule the next fire.
6. if genuinely blocked on a decision only dom can make, stop and say so. otherwise keep going.

## status

- last completed: **phase 0.4** ... the binder at `/work/[id]` (the structure tree as an outliner; a leaf links the existing editor verbatim; add-page + reorder via the fractional position; a "new work" form picker + the `promotePieceToWork` action on /library). verified with a REAL playwright screenshot (authed-full via the dev-login route): the novel skeleton renders ... act one / chapter 1 / scene 1 / act two / act three, with the golden-hour add affordances.
- current fire: **phase 1.1** ... novel/series binder polish (corkboard + word targets + subtree rollup).
- the suite: 404 tests green.

## the ladder

### phase 0 ... the keystone

- [x] 0.1 `v0_7_0_np_works.sql` + `src/types/works.ts` + `src/lib/forms/` (registry + constraints + test) + the vision/architecture docs.
- [x] 0.2 applied `v0_7_0` to the live substrate (3 tables + 12 policies + 3 np_pieces columns, RLS on) + regenerated `src/types/supabase.ts`; built the db layer `src/lib/db/works.ts` + `nodes.ts` + `links.ts` (`createWork` + skeleton seed, `createNode` / `createLeafNode` / `moveNode` / `deleteNodeSubtree`, `getWorkTree`, `promotePieceToWork`, `createLink` / `backlinks` / `resolveLink`) + the pure `src/lib/works/tree.ts` + `map.ts` + a 9-test pin.
- [x] 0.3 the import/export keystone: installed `@platejs/markdown`; `src/lib/io/markdown.ts` (`markdownToSlate` / `slateToMarkdown` via a headless `createSlateEditor` + basic-nodes + link + MarkdownPlugin) + a 5-test round-trip pin; `POST /api/import` (md -> Slate -> a new piece, RLS-owned) + `POST /api/export` (pieceId -> Slate -> md). Slate JSON is the one source of truth, proven end to end.
- [x] 0.4 the binder at `/work/[id]`: server component rendering the tree (`getWorkTree`) as an outliner, a leaf links `/editor/[pieceId]` (the existing plate-shell verbatim), add-page (`createLeafNode`) + up/down reorder (`moveNode` + `midpointPosition`) via form-actions; `src/components/binder/binder.tsx` + `src/app/(authed)/work/[id]/{page.tsx,actions.ts}`. `/library` gains a "new work" form picker (`newWorkAction`, 8 forms) + the `promotePieceToWork` action (`work-actions.ts`); the existing /library + /editor + /p/[slug] are untouched. screenshot verified authed-full.
- ship gate (met): a writer creates a Work, sees the structure in the binder, opens a leaf in the editor, imports a markdown file (/api/import), exports it back (/api/export). every existing flow still works (suite 404 green). NOTE: the per-card "promote" button is a quick follow-up (the action is built); the binder uses up/down reorder (drag is a later polish).

### phase 1 ... prose works

- [ ] 1.1 novel/series binder + corkboard (synopsis cards writing `position`) + chapter word-targets + subtree word-count rollup in the autosave action.
- [ ] 1.2 work-scoped voice extraction (`listPieceTextsForUser` by `work_id`).
- [ ] 1.3 work-level reading at `/w/[slug]` (tree -> TOC + paginated `PieceBody` per leaf).
- [ ] 1.4 export OUT: `mammoth` + `docx` (docx in/out), `@lesjoursfr/html-to-epub` (epub).

### phase 2 ... the editorial brain

- [ ] 2.1 `v0_8_0_np_editorial.sql` (stage + passes); fix the `PieceStatus` drift.
- [ ] 2.2 the `Finding`/`Lens` layer, deterministic lenses first (mechanical, readability-vs-own-voice, voice-drift), then promote `xray.ts` as the structure lens.
- [ ] 2.3 `src/lib/editorial/state-machine.ts` (pure transitions, unit-tested) + `src/lib/db/editorial.ts` (advance-gate + pass upsert + staleness read).
- [ ] 2.4 the ladder stepper + right-rail pass panel + left-margin live findings via the `xray-spine` overlay. + playwright.

### phase 3 ... the ai author + poetry

- [ ] 3.1 `AUTHOR_CONFIG`/`isAuthorTask` in `provider.ts`; `src/lib/ai/author.ts` + `prompts/author-prompt.ts`; `POST /api/ai/author`; the scaffold/outline view; `expand`/`draft-this-beat` in the slash menu.
- [ ] 3.2 poetry (zero migration): the `verse_line`/`stanza` blocks + `groupBodyBlocks` branch + renderer case; the scansion/rhyme/form-shape deterministic lenses; the `verse`/`coin` repair loop. + playwright.

### phase 4 ... world bible + continuity + series

- [ ] 4.1 `v0_9_0_np_bible.sql` + `v0_10_0_np_continuity.sql` (enable `pg_trgm`; check `list_extensions`).
- [ ] 4.2 the deterministic continuity layer (self-join + trigram) then the xray-shaped model layer; the resumable scan (clone `email/dispatch.ts` body-hash + two-phase token); the incremental autosave-triggered piece scan.
- [ ] 4.3 the codex + continuity rail + flags inbox; retrieval-by-mention into the author/partner prompt's bible slot; series as Work-of-Works. + playwright.

### phase 5 ... reference forms + multi-voice

- [ ] 5.1 conlang: the constrained coiner + lexicon record-leaf render + grammar reference + phonology registry in `work.settings`.
- [ ] 5.2 encyclopaedia: infobox record + `[[xref]]` inline node + citations -> footnotes/sidenotes + A-Z index.
- [ ] 5.3 `v0_11_0_np_voices.sql` + `getWriterVoice` -> `resolveVoice`, delta-voices, per-span tagging, drift-gated generation. + playwright.

### phase 6 ... the typeset flagship + cleanup

- [ ] 6.1 the `typeset` stage on `pagedjs` + `puppeteer` (+`@sparticuz/chromium`); front/back matter + running headers + the typography pass (`retext-smartypants` no-em-dash + `hyphen`).
- [ ] 6.2 optional `np_exports`; finish the scheduled-publish worker (pg-boss + `scheduled_publish_at` + the partial index exist, no worker runs); Scrivener import (`fast-xml-parser` + `rtf-parser`), isolated, last. + playwright.

## notes / decisions

- the data model is additive + nova-scoped; applying `v0_7_0` touches only `np_*` tables, zero risk to the other products on the shared substrate. the standalone exit ramp (`pg_dump --table='np_*'`) stays intact.
- every increment leaves nova fully working; `/library` + `/editor` + `/p/[slug]` are never broken.
