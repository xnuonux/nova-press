# the partner's proposal boundary

2026-09-25 ... stacked on the manuscript desk. draft source, not deployed.

## finding

the inspected author-beat source (`4ab43cf40c2f0dee1e4c19e323a71d127a2498c8`)
registered edit cancellation only after streaming finished. acceptance clamped the
original block index against the current document without checking its source.
the card also depended on a global tab shortcut and lacked touch acceptance.

## what is built

reuse the existing author endpoint, voice-keeper and audited-line formatter. no
new model, provider transport or database contract. every request captures the
local piece, title and complete rich json before sending. the pure proposal gate
checks source while streaming, at completion and synchronously at acceptance.

source drift makes the offer stale. the card can remain readable and copyable,
but not applicable. no insertion point is clamped. accepted additions go after
the original anchor and do not replace its text. an offer is consumed before the
plate transform runs, so a rapid second click or thrown transform cannot replay
it. a transform exception reports an unconfirmed insertion, not remote rollback
or a promise that the page stayed unchanged.

buttons explicitly weave in, copy or dismiss. tab acceptance is limited to the
owning editable, not unrelated inputs or controls; composition is ignored. a
piece key prevents proposals surviving a piece switch. late streams are invalidated
on cancellation/unmount. the response is capped at 32,768 characters and an outline
at 32 audited lines; other tasks permit one paragraph or one verse line. copy is
a deliberate clipboard operation, never an insertion.

## scope and limits

this is client-side proposal custody, not a cryptographic or server-pinned
revision, durable proposal inbox, ai-quality assessment, cross-tab coordination,
collaboration, remote cancellation or a guarantee against every existing editor
mutation path. the ghost-whisper path is unchanged. context sent to the model is
the existing command context, not the entire captured source. source capture is
used locally to guard application and is not a new model upload.

normalization that changes the captured json will conservatively make an offer
stale. check the actual slash-command normalization timing before merge. the same
mounted-editor event assumptions as prior patches remain; simultaneous editors
need a separate scoped event-bridge refactor. no silent retry is added.

## actual checks

37 new pure proposal tests passed. combined with the desk and prior safety tests,
176 focused node cases passed with zero failures or skips. strict typescript
checking passed for the three new helpers. four changed tsx modules passed syntax
transpilation. none of these establishes rendered react 19 / plate integration.

```sh
node --test scripts/verify-save-safety.mjs scripts/verify-release-safety.mjs scripts/verify-manuscript-desk.mjs scripts/verify-author-proposal.mjs
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

full application dependencies could not be installed because vm dns could not
resolve package-download hosts. full app tests, typecheck, lint, build, live model
streaming, auth, persistence and the historical 801-test suite remain unrun.

before merge, exercise slash deletion/normalization, ime, edits during streaming,
title-only and formatting-only edits, undo, stale copy, denied clipboard, empty
and oversized streams, late errors, route changes, strict-mode teardown, touch
buttons, keyboard focus, ghost/author tab ownership, and partial transform errors.
verify the original paragraph survives and there is never an automatic second
insert. no native lunari, schema, workflow, key, merge or deployment is changed.
