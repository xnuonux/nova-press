# NOVA PRESS · Codex INSTRUCTIONS

> last updated 2026-05-22 · v2 · maintained by nova press sub-chat in lunari titan

## WHAT

nova press is the AI writing studio for serious creators. word-by-word voice fidelity, magazine-grade reading view, multi-platform distribution as a first-class output. the editor breathes, the AI partner is invisible until called, the published piece feels like print.

## WHY

every existing writing tool either auto-completes you out of your own voice (jasper, copy.ai) or treats writing as an afterthought to the database (notion). nova exists because writing is craft, the AI should serve the craft, and the published artifact should feel expensive. wedge: voice fidelity, magazine reading view, native multi-platform repurpose.

## HOW

next.js 15 + react 19 app router with `src/` dir. plate as the editor spine. shadcn for UI primitives. lunari design tokens in tailwind config with nova's golden hour accent `#c9a84c`. IBM Plex Serif for body, Inter for UI, Iosevka for code. vercel AI SDK for the partner integration. nova's data lives in the SHARED LUNARI supabase substrate (project `fpposmirumtbocqtxued`) ... never a separate project. all nova tables are prefixed `np_`. pg-boss for scheduled publishing. multi-platform repurpose engine compiles one source piece into newsletter, twitter thread, linkedin post ... all voice-matched.

## VOICE RULE (non-negotiable)

- lowercase energy in all written content (UI strings, comments, commit messages, docs, error messages)
- NO em-dashes EVER. use `...` for pauses. if you reach for an em-dash, restructure the sentence
- sound like dom wrote it: punchy, vulnerable-but-confident, direct
- product copy carries NOVA's voice: golden hour, the muse, emotionally fluent, knows when to shut up so the writer can flow

## SCOPE

in: writing editor, AI sparring partner, reading view at `/p/[slug]`, publishing lifecycle, multi-platform repurpose, subscriber capture (basic), settings.
out: team collaboration in v1, real-time multi-cursor editing, version control beyond autosave, comments, image generation (use external), video, audio.

## WORKFLOW

- before touching code, read `docs/00-product-spec.md`
- before writing a new module, read `docs/01-architecture.md`
- use `/ship` for any task larger than a one-line fix (plan → tdd → review → commit)
- run `pnpm dev` to verify, `pnpm test` before any commit
- branch per task, never commit to main directly
- conventional commits only (feat:, fix:, refactor:, docs:, chore:, test:)
- before adding a new editor feature, check if plate already ships it
- never auto-complete more than one sentence unless explicitly asked
- always preserve the user's voice signature on AI-suggested rewrites
- magazine reading view must load in under 200ms or it doesn't ship

## TOOLING

- pnpm not npm
- prettier + eslint + typescript strict, pre-configured
- husky pre-commit runs lint-staged, commit-msg blocks em-dashes
- vitest for unit tests, playwright for e2e (later)
- shadcn/ui for components, lunari design tokens in `tailwind.config.ts`

## INVARIANTS (never break)

- never push to main
- never commit `.env`, `.Codex/settings.local.json`, `docs/voice-corpus.md`, or anything in `/private`
- never disable strict mode in `tsconfig`
- never paste API keys into code or comments
- never bypass voice-keeper skill warnings

## SHARED SUBSTRATE (LUNARI supabase, project `fpposmirumtbocqtxued`)

nova lives in eternities inc's shared database alongside lunari, cinema, factory i, and gen connect. it is not, and will never be, on its own supabase project. integration with lunari happens at the app layer, not the schema layer.

table invariants:

- every nova-owned table is prefixed `np_`
- cross-product foreign keys are limited to `auth.users(id)` and `voice_profiles(user_id)`. nothing else.
- nova never FKs to `public.user_core` (that's lunari's consciousness profile)
- RLS is enabled on every `np_*` table, four-policy CRUD on `auth.uid() = user_id` (atlas pattern, no redundant service-role-bypass policy)
- migration files are named `vX_Y_Z_np_<feature>.sql`. nova is on its OWN semver `v0.x` track, not lunari's `v17.x` line.
- nova reuses the existing `tg_set_updated_at()` trigger from v17_8_6 ... do not redefine it

shared table column ownership (CRITICAL ... app-enforced, since RLS can't gate columns):

on `public.user_profiles`:

- nova writes `is_nova_press_only` and `signup_surface = 'nova_press'`. NOTHING ELSE.
- never touch `is_lunari_user`, `is_gen_connect_only`, `is_lunari_company`, or any other surface's flags.

on `public.voice_profiles`:

- nova writes `writing_overrides`, `writing_samples_count`, `active_for_writing`. these are nova's columns.
- nova appends to `extraction_history` (jsonb), trims to last 5 entries in the extraction job.
- nova may last-writer-wins on base voice columns (register, sentence_length_avg/variance, paragraph_length_avg/variance, vocabulary_signature, formality_score, opening_patterns, closing_patterns, avoided_phrases, idiosyncratic_phrases, emoji_signature, punctuation_style) AND on extraction metadata (last_extracted_at, last_extracted_by='nova_press', extraction_model, extraction_confidence).
- nova never touches `outreach_overrides`, `outreach_samples_count`, `active_for_outreach`. those belong to gen connect.

standalone exit ramp (preserved option): `pg_dump --table='np_*' --table='voice_profiles' --table='user_profiles' --schema=public ...` then re-issue gotrue invites in the standalone target.

billing: nova does NOT have its own anthropic, openai, or vendor accounts. it shares eternities inc's keys. when integration day comes, billing is already unified.

full detail: `docs/06-database-design.md`.

## WHEN STUCK

- search `docs/` first
- search existing code with grep
- ask dom in the parent chat, don't guess
- if a decision affects architecture, escalate to the nova press sub-chat in lunari titan

## ESCALATION PATHS

- ambiguous scope → escalate to nova press sub-chat
- ambiguous strategy → escalate to dom via the sub-chat
- ambiguous architecture → escalate to VEGA (operating chat in lunari titan)
- ambiguous voice → run `/voice-check`, then ask in the sub-chat

## CONTEXT REFERENCES (read on demand, not always)

- when working on the editor or plate, read `docs/01-architecture.md` and the `plate-editor` skill
- when working on the AI partner, read the `voice-mirror` skill and `docs/03-voice-corpus-placeholder.md`
- when working on the published view, read the `reading-view` skill and `docs/02-design-system.md`
- when working on copy or strings, the `voice-keeper` skill fires automatically
- when touching the db, schema, migrations, or anything that crosses into shared substrate, read `docs/06-database-design.md`
