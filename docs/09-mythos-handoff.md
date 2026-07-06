# nova press · the mythos · handoff

> written 2026-07-05, at the close of the autonomous build. the ladder in
> `docs/MYTHOS-BUILD-LOG.md` is complete, phases 0 through 6.2, all on branch
> `feat/mythos-editorial-system`. 801 tests green. never merged to main ...
> that call is dom's.

## what shipped, in one breath

works + the binder + corkboard; import/export (md, docx, epub, scrivener in;
md, docx, epub, print-pdf out) with the np_exports receipt ledger; the
editorial brain (lenses, the 7-stage ladder, the pass panel); the ai author +
poetry; the world bible + continuity + series; conlang + encyclopaedia +
multi-voice; the typeset flagship (pagedjs + chromium, real ibm plex serif,
running heads, folios, a toc whose numbers match the printed pages); and
scheduled publishing with a worker.

## how to run it

- `pnpm dev` ... the app. `pnpm typecheck` then `pnpm test` (SEQUENTIALLY,
  never parallel ... they oom together on this machine).
- the typeset pdf needs a chromium: env `NOVA_CHROMIUM_PATH`, or playwright's
  local browser, or a desktop chrome/edge (the resolver walks that chain; on
  serverless linux it uses @sparticuz/chromium).
- scheduled publishing: set `NOVA_WORKER_SECRET` (in .env.local already for
  dev) and either run `pnpm worker:publish` (pg-boss, needs `DATABASE_URL`
  ... EMPTY on this machine today, fill it with the direct postgres string)
  or point any cron at `POST /api/worker/publish-due` with the
  `x-nova-worker-secret` header. the endpoint is inert unless the secret is
  set. the worker uses its OWN `np_boss` schema ... never the shared `pgboss`
  schema another product owns.

## the state of the loose ends

- the 6.2 adversarial review pass was stopped early at the operator's budget
  call. everything else in 6.2 was fully verified (unit + a complete e2e +
  screenshots), and the one self-caught finding (non-atomic scrivener import)
  was fixed with a work-level rollback. FIRST THING next session: run a
  review workflow over commit range 190a909..HEAD.
- known cheap follow-ups, unchanged from the log: lazy-mint a piece on first
  click of a seeded skeleton leaf; per-span (per-block) voice tagging; drag
  reorder in the binder; a "promote piece" button on the library card.
- prod deploy notes: `maxDuration = 120` on the pdf route; the render budget
  is 90s by design (the friendly timeout must beat the platform kill). the
  plex faces embed from `node_modules/@fontsource/ibm-plex-serif` ... on a
  serverless bundle, make sure those files trace (outputFileTracingIncludes
  if they don't).
- the migrations v0*7_0 through v0_12_0 are all APPLIED live on the shared
  substrate. the pg_dump exit ramp stays clean (np*\* + the two shared
  tables).

## where the deep knowledge lives

`docs/MYTHOS-BUILD-LOG.md` is the true history ... every fire's shape, every
review finding, every deliberate limit (the split-ellipsis pin, the dropped
folio counter-reset, why the smarten pass is pure code and not
retext-smartypants). read it before touching the typeset or continuity
spines. and thank you for the trust ... it was a good build.
