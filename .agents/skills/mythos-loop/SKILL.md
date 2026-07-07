---
name: mythos-loop
description: Run an autonomous, self-perpetuating "build the next increment to perfection" loop. Use when an operator wants an AI coder to keep shipping vertical slices of a large system unattended ... each increment built spine-first, verified end-to-end, adversarially reviewed, committed clean, then the next one scheduled. Encodes the exact loop that built the nova press "mythos" editorial system (phases 4.2 through 5.1+).
---

# mythos-loop

the autonomous perfection loop. one fire of this loop = one whole increment of a system, taken from "next unchecked item" to "committed, verified, reviewed, clean" ... then it schedules its own next fire and walks away. it is how a single AI coder ships a large system slice by slice while the operator sleeps.

this is not a vibe. it is a fixed shape repeated with discipline. the discipline IS the product.

## the prime directive

ship the next increment so well that an adversarial reviewer can't find a real hole in it. then prove it. then do it again. quality is the only speed.

## the state machine lives in a build log

the loop has no memory between fires except the repo + ONE markdown file (e.g. `docs/MYTHOS-BUILD-LOG.md`). that file is the spine:

- a "last completed" entry (a fat, honest paragraph of what shipped last fire)
- a "current fire" entry (the increment to build THIS fire)
- a "suite: N tests green" line
- a ladder of `[x]` done / `[ ] ` pending increments, each phase grouped

every fire READS this log first to know where it is, and WRITES it last to record what it did + point at the next thing. if the log and the code disagree, the code is the truth ... fix the log.

## the invariant shape of one fire

1. **read the build log.** pick the next unchecked increment. if scope is ambiguous, re-read the architecture/vision docs; do not guess.
2. **explore before building.** map the existing seams you'll mirror (grep, read, or fan out read-only `Explore` agents in parallel). a new feature should look like the codebase wrote it. find the pattern that already exists ... most of what you need is usually already there (a form already in the registry, a record column already in the schema).
3. **build it, DETERMINISTIC SPINE FIRST** (see below).
4. **verify** (typecheck + test SEQUENTIAL, em-dash sweep, a real e2e + a screenshot read back).
5. **adversarial review** over the working-tree diff (lens agents -> skeptic-verify -> fix confirmed only).
6. **re-verify** after the fixes.
7. **hygiene + commit** (stage only what you authored, NUL sweep, stray sweep, conventional message, the exact trailer).
8. **update the build log** (last completed -> this increment, current fire -> the next one, the suite count, the ladder).
9. **schedule the next fire** (`ScheduleWakeup`, ~60s, the SAME loop prompt advanced one increment).

steps 4 + 5 are non-negotiable. an increment that skips them is not done, it's a liability.

## deterministic spine first

every increment has a pure, exact, unit-testable core ... build + test THAT before any db, route, or UI touches it. the model layer wraps the deterministic core, never replaces it. concretely:

- pure module(s) under `src/lib/...`, no `server-only`, no db imports, no React. validate, normalize, parse, compute. **unit-test it hard FIRST** (legal + illegal + edge + the adversarial input you expect a reviewer to try). these tests are the proof the feature is correct.
- THEN the db layer (RLS owner-scoped; reads NEVER throw + degrade to `[]`/`""`; writes return a discriminated `{ok}|{error}` result).
- THEN the model/AI layer if any ... a pure prompt + a defensive parse, the server call wrapped to **degrade to a safe default and never throw** (the "xray-shaped" pattern). a model proposes WITHIN the deterministic rails; the deterministic gate validates; a deterministic fallback guarantees a result even with no model.
- THEN the routes / server actions (public boundaries: re-check session, uuid-shape-guard before a uuid-column lookup, rate-limit any model call, owner-gate).
- THEN the UI (a calm island that mirrors the established panel pattern; lowercase voice; the project's design tokens).

the payoff: when the adversarial review comes, the heart of the feature is already proven by tests and the reviewer is left poking at wiring.

## verify (the exact protocol)

- **run `typecheck` and `test` SEQUENTIALLY, never in parallel.** they OOM together ("Zone Allocation failed"). typecheck first, then the full suite.
- **em-dash sweep = 0** on every authored file. the voice forbids em/en-dashes; use `...`. (the only legitimate matches are a dash-stripping regex character class + its test fixture ... judge those by context, never let a real one through.)
- **a real end-to-end test + a screenshot read back.** stand up the app (a fresh dev server on a spare port), drive the actual user path with a throwaway driver (playwright for UI, fetch for routes), assert the outcome, screenshot it, and `view` the screenshot to confirm it renders. when the deterministic outcome is hard to scrape from a stream, assert it at the db level (the db is the source of truth ... a "the save didn't show in 2.5s" failure is usually a cold-compile timing artifact, provable by reading the row).
- fix every real issue the verify turns up before moving on.

## adversarial review (the workflow)

author + run a review `Workflow` over the working-tree diff. the shape that works:

- a `pipeline` of N LENS agents, each a distinct angle (security/RLS/ownership, the deterministic-core correctness, the db/race correctness, the model-degradation, the UI/react/a11y, voice/dead-code). each returns structured `findings` (a JSON schema).
- each finding is then SKEPTIC-VERIFIED by its own agent, prompted to REFUTE it ... default `isReal: false` unless it can confirm the bug by reading the code. most raised findings are not real; the verify pass is what separates signal from noise.
- collect only the CONFIRMED findings. fix EVERY one, re-verify, then commit.

scale the lens count + the skeptic rigor to the surface area. a typical increment: 6 lenses, ~16-27 agents, raises ~16-20, confirms a handful. the confirmed ones are usually real and worth it (a non-atomic delete that silently loses data, a flag id that re-raises a dismissed item, an un-rate-limited model boundary on shared keys).

## hygiene + commit

- **stage ONLY files you authored this increment**, by explicit path. never the known untracked strays, never `.env`/keys, never throwaway probe/driver/`.txt`/`.png`/`_*.mjs` files the e2e or the review agents leave (sweep + delete them first).
- **NUL-byte sweep every staged source file by EXPLICIT PATH.** `git status` lists untracked DIRECTORIES, so a naive sweep misses files inside new dirs ... expand them. a single NUL byte makes git treat a `.ts` as binary (a copy-paste artifact once turned a hash delimiter into `\x00bible\x00`); it compiles + lints fine but breaks `git diff`/`blame` + the text exit-ramp. `python -c "print(open(p,'rb').read().count(b'\x00'))"` must be 0 on each.
- **never push, never commit to main.** stay on the feature branch.
- **conventional commit**, lowercase, no em-dashes in the message, body explains the shape + the review fixes. end with the operator's exact co-author trailer.
- after the hooks run (lint-staged reformats staged files mid-commit ... that's normal, the commit proceeds), verify HEAD moved + the tree is clean + no file landed as `Bin` in `git show --stat`.

## self-perpetuation

the last act of a fire is `ScheduleWakeup` (~60s) with the SAME loop prompt, advanced one increment (last-completed and current-fire bumped). that re-fires the loop. the build log + the repo carry all the state; the prompt carries the discipline. omitting the schedule ENDS the loop ... which is the clean way to stop.

## the loop-prompt template (what each fire receives)

```
Continue the <project> autonomous perfection loop. Phase <prev> (...) is committed
and complete (HEAD <sha> on <branch>). Read <build-log>, then build the next
increment: PHASE <next> ... <one-line scope>.

FIRST, orient: read <build-log> + <arch/vision docs>, and grep the existing
<seams to mirror> so the new work matches the established pattern.

Build, in this order (DETERMINISTIC SPINE FIRST: pure, unit-tested helpers before
db / routes / UI):
1. <the pure spine> ... unit-test it hard.
2. <the db layer> ... RLS owner-scoped, never-throw reads.
3. <the model layer, if any> ... proposes within the rails, degrades to a safe
   default, never throws.
4. <the routes / actions> ... auth + uuid guard + rate-limit + owner gate.
5. <the UI> ... mirror the established panel, lowercase, design tokens.

VERIFY: typecheck + test SEQUENTIALLY (never parallel ... OOM). em-dash sweep 0.
a playwright e2e + a screenshot read back: <the concrete user path + assertion>.
fix every real issue. NOTE: the dev server orphans past a TaskStop ... kill the
listener on the port before a fresh start, and stop it after.

ULTRACODE REVIEW: author + run an adversarial review Workflow over the diff
(lens agents -> skeptic-verify each finding -> confirmed only). fix every confirmed
finding, re-verify, before committing.

SECURITY/HYGIENE: stage ONLY files you authored. never <the known strays> or keys,
delete throwaway *.txt/_*.mjs/*.png. BEFORE staging: NUL-byte sweep every authored
source file by EXPLICIT PATH (git status lists untracked DIRS, expand them). if a
migration is needed, follow the schema invariants + regenerate the db types. never
push, never commit to main. Conventional commit, lowercase, no em-dashes, exact
trailer: <co-author trailer>.

When <next> is committed, update <build-log> (last completed -> <next>, current
fire -> <next+1>, the suite count, the ladder), then ScheduleWakeup (~60s) with
this loop prompt advanced to the next phase. loop this development to perfection.
```

## hard-won environment lessons (the ones that cost real time)

- **typecheck + full test in parallel = OOM.** always sequential.
- **lint-staged flakes on a cygwin/windows fork storm** ("eslint --fix failed without output"). it's the env, not your code ... confirm with a direct `eslint` run (exit 0), then retry the commit; the retry usually passes.
- **the NUL-byte binary trap** (above). sweep by explicit path.
- **the dev server orphans past a `TaskStop`** and keeps holding its port (serving STALE code, so your e2e tests the old build). kill the actual listener (`Get-NetTCPConnection -LocalPort <port> -> taskkill //PID //F`) before starting a fresh one; stop it after.
- **a fresh dev server compiles server actions on first call** (slow). an e2e assertion that fires <3s after a first-ever action can fail on timing while the write actually SUCCEEDED ... confirm at the db, don't trust the clock.
- **`git status` shows untracked directories, not their files.** any per-file sweep (NUL, em-dash) must expand new dirs explicitly.
- **`grep -c` exits 1 when the count is 0**, which can abort an `&&` chain ... that exit 1 is the CLEAN result.
- **a pre-existing hydration warning** (e.g. a binder form, a browser-injected `caret-color`) is not your regression ... react reports the FIRST divergence point; if it's in code you didn't touch, it predates you.

## cost + control (read this before you start one)

this loop SELF-PERPETUATES and spends heavily ... each fire runs a full test suite, a dev server, a real e2e, and an adversarial workflow of dozens of agents. left alone it runs indefinitely, fire after fire, day after day. that is the point AND the risk. only start it when the operator has explicitly opted into that autonomy and cost. it stops cleanly the moment a fire does not schedule the next one (or the operator interrupts) ... there is no recurring cron, just the per-fire re-schedule. the repo + the build log are always at a clean, reviewable resting point between fires.
