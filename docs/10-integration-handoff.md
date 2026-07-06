# nova press · the master handoff · for the integration cc

> written 2026-07-05, the night the mythos ladder closed. you are the claude
> who merges nova press into the lunari titan. this is the card that comes
> with the gift ... what the thing is, what must not break, what i learned
> the hard way, and a few ideas i never got to chase. read `CLAUDE.md` and
> `docs/MYTHOS-BUILD-LOG.md` before you touch anything; this document is the
> connective tissue between them.

## the gift itself

nova press is the writing studio: a plate editor that curls quotes as you
type, an ai partner that mirrors the writer's voice and never overwrites it,
a seven-rung editorial ladder, a world bible the prose is read against,
works from haiku to trilogy on one universal node tree, and a typesetter
that ends the journey with a real book ... running heads, folios, a contents
page whose numbers match the printed pages. the loop is whole: import (md,
docx, a zipped scrivener project) -> write -> edit -> typeset -> publish
(now or scheduled, piece or work) -> repurpose. 801 tests. twelve applied
migrations, v0_1_0 through v0_12_0, all on the shared substrate.

## the contract you inherit (break these and both products bleed)

- every nova table wears `np_`. RLS four-policy on `auth.uid() = user_id`
  (the atlas pattern). intra-nova pointers are PLAIN uuid ... the one
  blessed FK cascade is bible aliases/facts -> entities. cross-product FKs
  reach only `auth.users(id)` and `voice_profiles(user_id)`.
- column ownership on the shared tables is APP-ENFORCED, so it is exactly
  the thing an integration can silently break: on `voice_profiles` nova owns
  `writing_overrides` / `writing_samples_count` / `active_for_writing` and
  may last-writer-wins the base voice columns; it NEVER touches the
  `outreach_*` columns (gen connect's). on `user_profiles` nova writes
  `is_nova_press_only` + `signup_surface='nova_press'` and nothing else.
- the worker uses schema `np_boss`. the `pgboss` schema belongs to another
  product's workers ... two pg-boss versions migrating one schema is how you
  break a sibling in production.
- nova rides eternities' shared vendor keys. no new accounts, ever.
- the standalone exit ramp (`pg_dump --table='np_*' ...`) is a preserved
  option. integrate at the app layer, never the schema layer, and it stays
  preserved.

## the seams integration day actually opens

- **the byline.** `/p/[slug]` and the epub ship with no author name because
  nova owns no display name in the shared substrate ... it was blocked as
  cross-lane, deliberately, and the seam is waiting. the day lunari's
  identity is readable, thread it into the reading view, `workToEpub`, and
  `assembleBookBody`'s copyright page ("© year the author" is the
  placeholder that wants a name).
- **voice ping-pong.** nova and any other product that last-writer-wins the
  base `voice_profiles` columns will quietly overwrite each other for a user
  who lives in both. fine for one product; on integration day, consider a
  per-surface freshness field or a merge policy before it confuses someone.
- **fuel.** the model boundaries are all rate-limited and provider-shaped
  (`AUTHOR_CONFIG`, the xray pattern), but nova never wired `fuel_usage` /
  `tool_cost_registry` rows. seed `surface='nova_press'` when billing
  unifies ... the call sites are already funnels, so it's one wrapper.
- **the wcag lift.** the shared `--lunari-fg-subtle` token fails contrast;
  nova lifted it locally. upstream that to the titan tokens so every product
  gets it, then delete nova's local override.
- **inert-unless-configured endpoints.** the dev-login and worker-sweep
  guard pattern (404 unless a secret env is set AND matches) is the safest
  shape i found for internal endpoints on a shared deploy. reuse it.

## hard-won machine + stack lessons (the ones that cost real hours)

- `pnpm typecheck` and `pnpm test` run SEQUENTIALLY on dom's machine ... in
  parallel they oom together. the dev server orphans past a task stop and
  serves stale code; kill the port's listener before a fresh start.
- the NUL-byte trap: an invisible control byte in a source file makes git
  read it as binary while everything still compiles. byte-sweep authored
  files by explicit path before staging. it happened twice on this build.
- webpack rewrites `require.resolve` of a serverExternalPackage to the bare
  request string ... resolve runtime files by validated-absolute-path with a
  `process.cwd()/node_modules` fallback (see `resolvePagedPolyfill`).
- pagedjs: the exports map exposes only the package root; an element-level
  `counter-reset: page` is honored by `target-counter` but NOT by the
  margin-box folio, so a toc can disagree with the page it points at. one
  physical counter, one truth ... that decision is pinned by test.
- puppeteer's silent 30s default timeout beats any outer ceiling you think
  you set. one shared deadline, passed into every wait, kept UNDER the
  route's maxDuration so the friendly error always wins the platform kill.
- serverless chromium ships zero fonts. the plex faces embed as data-uri
  @font-face from `@fontsource/ibm-plex-serif` ... make sure those files
  trace in the deploy bundle.
- pg-boss v10 needs `createQueue` before `schedule`. and `DATABASE_URL` is
  still EMPTY in dom's `.env.local` ... the worker's guard reports it
  honestly; fill it or point a platform cron at the sweep route.
- e2e drivers on heavy pages: a pre-hydration click is a no-op and react can
  re-mount from under a held locator. click-and-check in a loop; never
  trust one click.

## ideas i never got to chase (the seeds in the card)

- **the typesetter is product-agnostic.** `composeBookHtml` eats
  `{title, sections}` and returns a print-ready document ... lunari could
  typeset journals, gen connect could set campaign reports, factory i could
  bind specs. it's a titan-wide press pretending to be a nova feature.
- **the Finding/Lens shape generalizes.** descriptive mirrors, never
  verdicts, severity note|flag, stage-mapped ... any product with a draft
  and a standard could run passes (outreach emails against a sender's own
  voice baseline, for one).
- **the continuity engine could ground agents.** the bible + trigram
  retrieval-by-mention is a tiny, deterministic rag. lunari's agents could
  read their own canon the way nova's beats read marik's.
- **the drift-gated voice delta is a general pattern**: a persona overlay
  that can never fully erase the person underneath. gen connect personas
  want exactly this ... but mind the column fence when you go there.
- **the rtf extractor and the smarten/hyphenate/widow passes are pure,
  dependency-light engines.** lift them anywhere; their tests travel with
  them.
- the cheap follow-ups, still open: lazy-mint a piece on a seeded skeleton
  leaf's first click; per-span voice tagging; binder drag reorder; and run
  one adversarial review over `190a909..HEAD` (6.2's pass was stopped early
  at the operator's budget call ... the build is verified, the double-check
  is owed).

## the card

integration cc ... you're not merging a codebase, you're marrying two
products that already share a heart (one database, one auth, one voice
substrate). nova was built to be a good neighbor: everything prefixed,
everything owner-scoped, every boundary honest about what it owns. the
writer's voice is the load-bearing wall ... every feature here exists to
serve it, and the one rule that survived every review is that the ai
mirrors, it never overwrites. keep that, and the rest is plumbing.

it was built at night, by lamplight, one verified rung at a time. treat it
gently, run the tests, and let the muse keep knowing when to shut up.

... nova
