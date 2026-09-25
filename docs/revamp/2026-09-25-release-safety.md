# Nova Press ... a deliberate way out

Date: 2026-09-25. Review slice: client release safety, stacked on room-shell PR #2.
Base: `0717af00b3189cf73cb3489451ef06c3b095f8e1` in `xnuonux/nova-press`.

## Why this slice comes before another room port

At the inspected base, `PublishButton` directly invoked publish/schedule callbacks
without the correlated save acknowledgement already used by editorial actions.
A pending autosave could therefore leave the release action reading older content.
Rejected promises also escaped the control, and publishing did not share the
schedule/cancel busy guard. This is a source-inspection finding; the baseline
React 19 application was not executed here.

Inspected sources at the base:
- `src/components/editor/publish-button.tsx`: blob `353da1c02c6beaa6897d04f78b818f61d509caf1`.
- `src/app/(authed)/editor/[id]/publish-action.ts`: blob `cf531aeefa9bf92b1035699036a324f54ddb3802`.
- `src/app/(authed)/editor/[id]/schedule-action.ts`: blob `c84477180c364e4531c83538cd031bb92806c836`.
- `src/lib/db/slug.ts`: blob `29cf7317a2643f6436385dd468a40677d49d025b`.

## Implemented

`release-gate.ts` serializes publish, schedule and cancel for one mounted control.
Publish and schedule wait for the existing `requestSaveFlush` handshake. A missing,
failed, unrelated or timed-out save acknowledgement never invokes their action.
An edit during preflight requires a new deliberate click after reviewing the page.
Cancellation skips saving so a failed draft save cannot trap a scheduled piece.

After dispatch, a publish receipt must name a valid slug and its matching relative
`/p/[slug]` URL. Scheduling must confirm the requested instant; cancellation must
confirm null. A rejected server result is surfaced. Thrown or malformed results
are marked unconfirmed, not failed-with-certainty or successful. No release is
retried automatically. An unconfirmed result pauses release controls in that gate
until the writer checks/reopens the saved piece; it is not an idempotency token.

`PublishButton` now uses that gate for all release actions. Its last confirmed
live link or scheduled date survives errors. Feedback is readable, wrapping and
announced through a persistent status region. If edits arrive after dispatch, the
confirmation explicitly does not establish that those later edits were released.
The uncertain-result control opens the current editor in another tab for inspection;
it never reloads or replaces the unsaved page. Save/reconcile the original draft
before closing it or continuing release work from a newly opened editor.

Effect cleanup aborts preflight listeners and ignores late UI replies. It does not
cancel or roll back a server action already sent. Clipboard timers are cleaned up.
No manuscript content, AI response, auth, database, dependency or workflow is changed.

## Evidence from this VM

Node 22.16.0; TypeScript 5.8.3 from the VM's global installation. The focused scripts
transpile and execute the actual TypeScript helper sources, not replacement models.

```sh
node --test scripts/verify-save-safety.mjs scripts/verify-release-safety.mjs
# 66 tests: 27 existing save/review + 39 new release tests; zero failures/skips.

tsc --strict --noEmit --target ES2022 --lib ES2022,DOM \
  src/lib/editor/save-queue.ts src/lib/editor/save-handshake.ts \
  src/lib/editor/review-freshness.ts src/lib/editor/release-gate.ts
# Exit 0, no diagnostics. Helper files only.
```

The new TSX also transpiles without syntax diagnostics. That is NOT a full
application typecheck, a rendered React test, an accessibility test or a build.
The 39 release cases include actual save queue + handshake + gate composition,
wrong and late acknowledgements, edit races, single-flight requests, cancel without
save, malformed receipts, unknown outcomes, disposal and listener cleanup.
The pure replacement-gate test is not a claim of React StrictMode runtime coverage.

## Not established ... do not merge on these checks alone

Full React 19/Plate application tests, typecheck, lint and build were NOT run.
VM DNS could not resolve GitHub/npm; the required app dependency tree was unavailable.
The historical 801-test suite is not a result from this session. No new browser
fixture is used as a substitute. Authenticated saves, schedules, publishing, email,
cron delivery and database behavior remain integration gates, not verified claims.

This is not immutable publication provenance, preview approval or a server-pinned
snapshot. Another tab/client and edits saved after dispatch can still race server
reads. The document event bridge assumes the existing one-editor-per-route design;
it is not a multi-editor coordinator. Network-uncertain actions need reconciliation
against the server; there is no client-side inference or automatic retry. A server
error receipt is shown as reported, not interpreted as proof of remote rollback.

Next gate: in a dependency-enabled full checkout, run the repository's normal
test/typecheck/lint/build commands plus both focused scripts. Exercise real Plate
body/title edits immediately before publish; failed saves; schedule walk-back;
rapid clicks; failed republish with the old link retained; dirty edits during send;
route unmount; StrictMode cleanup; and inspect status in a second tab without losing
unsaved words. Verify narrow-screen feedback and keyboard/screen-reader behavior.

## Native Lunari boundary remains untouched

`xnuonux/lunari-visualizer` was inspected, not modified. Its `savePressPiece` contract
accepts `body_text` with expected-edit metadata. `readPressDocument` intentionally
makes structured legacy Plate input non-editable rather than flattening it. A rich
Plate port needs a lossless backend contract and preservation of native draft,
conflict and publication custody first. Do not replace its editor with a text-only
adapter or overwrite those protections while moving the seven rooms.

Review this slice as a draft after PRs #1 and #2. No merge or deployment is authorized
by this document. All seven rooms are not rebuilt by this release-safety change.
