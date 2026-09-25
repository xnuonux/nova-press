# nova press ... back to the room

2026-09-25 · audit, design contract, and staged implementation

## decision

keep the standalone studio as the component and craft-engine source. bring those parts into lunari through its existing service adapters. do not replace lunari's newer draft custody, owner isolation, compare-and-save, edition preview, or one-publication guards with the standalone app's older transport.

this is not a third writing product, a new database, or seven new dashboard tabs. the page is the center. the rooms contain the tools a writer deliberately reaches for.

## evidence and limits

standalone source pinned to `ca13dd77f6294025c8263c0f01eee3c1dd2cff1e`, on the repository's actual default branch, `feat/mythos-editorial-system`, not `main`. canonical intent: `docs/11-nova-press.md`, `docs/07-mythos-vision.md`, `docs/00-product-spec.md`, `docs/01-architecture.md`, and `AGENTS.md`.

lunari source: `xnuonux/lunari-visualizer`, `src/components/press/PressSector.tsx`, blob `1bcd378c5e9f0ebf485ab5ad478c454b6f4aeb0e`. inspected ranges 1-260 and 500-760, not a whole-repository runtime audit. the handoff's 1,279 lines and 27 states were not independently recounted. the local windows brief was not accessible in this session; the supplied handoff and repository documents are the inputs.

"801 tests green" is a historical statement in `docs/11-nova-press.md`. it is not a result from this audit. a fresh full dependency install, vitest suite, next production build, authenticated browser run, database policies, model output quality, live publishing, and print export are unassessed here. dependency retrieval was unavailable in the local execution environment.

## what actually needs repair

### 1. a room became a feature index

lunari's top-level destinations are library, works, editor, voice, subscribers, with global counts and actions. standalone has the actual plate editor, whisper, partner, craft lenses, binder, cast, codex, continuity, and typesetter. its work route also stacks many of these surfaces vertically. neither another dashboard nor another parallel editor is the answer.

### 2. saved and reviewed were not trustworthy enough

`src/components/editor/use-autosave.ts` acknowledged a flush when its debounce timer was absent, even if a write was already in flight. it emitted the same acknowledgement on success and failure. independent timers could permit overlapping writes.

`src/components/editor/editorial-panel.tsx` resolved a flush after four seconds without success evidence, then submitted a pass. a successful response always cleared staleness, including when the writer had edited while waiting. title edits were not part of the panel's body-edit notification.

first patch: a serial save queue, request-correlated success/failure acknowledgements, fail-closed flush timeout, cancellation, and a local review revision clock. the hook reports title changes too. a late pass may remain visible as a descriptive mirror but must remain stale. stage operations are serialized locally; backward movement remains possible without a successful save. server authority and existing stage rules are retained.

this is a mounted-editor client fix, not cross-tab compare-and-swap or server-level revision pinning. the current event bridge assumes one mounted editor per document. aborting a client request does not undo a mutation already received by the server.

### 3. reuse must not erase newer safeguards

lunari preserves last confirmed reads on failures, scopes pieces to the owner/request generation, retains unsaved local edits, submits `expected_edited_at`, and checkpoints one provenance before publication. preserve these behaviors. an unavailable read is not an empty library. the older vision's "failed read is an empty list" is not a license to erase known work.

### 4. a generated draft is not yet an accepted candidate

lunari's `draftPieceWithNova` calls `draft_leaf`, then accepts a server-returned saved piece. it protects local typing during the request, but that frontend path is not a separate proposal-and-accept workflow. inspect and change the backend contract before claiming the strongest "never overwrites" invariant. no backend drafting change is included here.

## the seven rooms

| room | the experience | reuse, then adapt |
| --- | --- | --- |
| the page | a quiet serif canvas, title, truthful save state, focus/typewriter controls. no default scores or growth counters. the document stays mounted when tools open. | `components/editor/plate-shell.tsx`, `plate-text.ts`, verse/list/link blocks, selection/command tools, repaired autosave. translate storage through lunari's safe document and save adapters. |
| the partner | closed until summoned. one sentence by default; explicit longer requests remain bounded. chat and ghost text never silently replace the draft. | `partner-rail.tsx`, `ghost-text.tsx`, `author-beat.tsx`, `lib/ai/partner-thread`. port transport separately from presentation; candidates need explicit acceptance. |
| the voice | the writer's measured habits, source coverage, and sparse cast overlays. insufficient evidence stays insufficient. no generic quality score. | `voice-trainer.tsx`, `voice-timeline-launcher.tsx`, `components/voices/voices-panel.tsx`. retain profile column ownership and drift boundaries. |
| the shape | binder/corkboard, scenes, acts, chapters, and form-specific records. a leaf opens the same page, not a second editor. | `components/binder/binder.tsx`, form/tree helpers, conlang and encyclopaedia panels. retain the universal node spine and series semantics. |
| the editorial brain | a chosen pass, observable findings, accept/dismiss, and explicit stage movement. "longer than your usual sentence" rather than "bad writing". | `editorial-panel.tsx`, deterministic lens registry and stage machine. preserve stale findings as stale; no timeout-to-success. |
| the world bible | the nouns, aliases, facts, series inheritance, and continuity observations beside the relevant work. | `components/codex/codex-panel.tsx`, `components/continuity/continuity-rail.tsx`. preserve owner scope, dismissal history, and retrieval by mention. |
| the way out | preview the exact artifact, choose its destination, deliberately release it, and receive a real receipt. private by default. | existing publish/schedule controls, `components/typeset/typeset-panel.tsx`, serializers and reading view. keep lunari's edition/provenance checks; do not transplant next server actions directly into vite. |

## surface rules

paper and typography do the work. use the existing serif and quiet golden-hour accent, a restrained masthead, generous measure, hairlines rather than nested cards, and one visual priority: the words. do not download new fonts or add a decorative rendering dependency for this pass.

on desktop, the page has a restrained room rail. opening a room reveals its existing tool surface; closing it does not reset it. on narrow screens, the room controls and opened surface flow above the page rather than trapping it under an overlay. closed content must leave the keyboard order. preserve visible focus and reduced-motion preferences.

only expose rooms backed by actual context and components. the first editor composition exposes partner and editorial brain; the current publish/schedule controls remain where their live state already resides. voice, shape, bible, and full artifact controls remain on their existing work routes until their dedicated integration slices. no disabled "coming soon" theater.

all authored copy follows the writer's law: mirrors, never verdicts; pauses are `...`. never normalize punctuation inside the writer's existing document without asking.

## small pull-request sequence

1. **save and review custody** ... repair the race before reusing it; add focused executable checks. no schema or provider change.
2. **the page and its doors** ... compose the existing editor, partner, and editorial panel into a quiet room shell. panel-only presentation adapters; no replacement editor. keep the document and hidden room children mounted. no model call, save, publication, or database migration merely from navigation.
3. **lunari page adapter** ... extract the current workspace coordinator without changing owner, request, dirty-draft, one, or publication behavior. mount the proven plate page behind a lossless document adapter and conflict-checked save. retain original rich data for unsupported blocks.
4. **the partner's proposal boundary** ... explicit candidates with base revision, diff/preview, accept or dismiss. stale candidates cannot be applied. keep one-sentence and voice constraints from the existing implementation.
5. **shape, voice, and bible** ... move proven work panels into contextual rooms one slice at a time, with contract and round-trip fixtures.
6. **review identity and the artifact** ... server-pinned review versions, cross-tab conflicts, exact edition preview, real exports and receipts. test public draft denial and prose/verse fidelity end to end.

## merge gates and handoff

run from a complete checkout with dependencies installed:

```sh
pnpm install --frozen-lockfile
node --test scripts/verify-save-safety.mjs
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

focused safety evidence in this session: 27 node tests passed, zero failed/skipped; strict type checking passed for the three dependency-free editor helpers. the changed hook and panel passed typescript syntax transpilation, not a full application typecheck. tests exercise the actual helper sources through the repository's typescript dependency, not a separate reimplementation. the 27 are additional focused checks, not a claimed new full-suite total.

before merging, mount the real react 19/plate editor under strict mode and test: initial mount does not save; type during a slow save; failed save then retry without another edit; request a pass during that save; edit the title/body while a pass runs; switch piece during a request; navigate away; hide/reopen tools; enter focus mode; inspect mobile keyboard order. a failed flush must produce zero pass requests. a stale response must never enable a forward gate. test a clean pass separately from a malformed or missing response.

no migration, provider credential, main/default-branch update, merge, deployment, newsletter send, or publication belongs to these review patches. draft pull requests are not releases. a complete native lunari port remains subsequent work.
