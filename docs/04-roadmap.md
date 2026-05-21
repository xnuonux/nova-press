# nova press · roadmap

four weeks. each week ends with something demo-able.

## week 1 · foundation + editor shell
**goal**: editor boots, plate types, autosave persists, design tokens visible everywhere.

- T-001 repo init + CLAUDE.md verified
- T-002 lunari design tokens in tailwind, nova accent visible on landing
- T-003 shadcn primitives installed (button, input, dialog, dropdown, popover, sheet, card)
- T-004 supabase project + cli + migrations 0001-0005
- T-005 type generation from supabase schema
- T-006 auth: magic link + session middleware
- T-007 app shell with top bar + (optional) left rail
- T-008 library page (no data) at `/`
- T-009 library data + virtualization
- T-010 new piece flow + slug generation
- T-011 plate minimal editor at `/editor/[id]` with base kits
- T-012 autosave hook + revision insert
- T-013 AI panel placeholder rail at right of editor
- T-014 sentry init + error boundary

ship: dom can sign up, open a new draft, type into the plate editor, see autosave chip, see the AI panel placeholder say "nova is listening."

## week 2 · AI partner + voice mirror
**goal**: nova mirrors voice on continue, rewrite, improve. accept/reject log writes. flow detection silences nova when in flow.

- T-015 vercel ai sdk + anthropic provider
- T-016 model selector (sonnet default)
- T-017 voice corpus ingestion endpoint + UI in settings
- T-018 voyage-3-large embed client
- T-019 voice metrics compute (function-word fingerprint, sentence stats, lowercase ratio)
- T-020 centroid + compact view + profile write
- T-021 pgvector HNSW index + retrieval function
- T-022 system prompts + per-command prompts
- T-023 `/api/ai/command` streaming endpoint
- T-024 plate AIKit + SlashKit integration
- T-025 plate CopilotKit + ghost text + one-sentence enforcement
- T-026 bubble toolbar AI actions
- T-027 accept/reject log + edit-distance worker
- T-028 drift detector + quiet toast
- T-029 flow detector + hysteresis + consequences
- T-030 nova partner side panel + chat
- T-031 rate limit + per-user cost cap
- T-032 prompt injection wrappers + output filter

ship: dom writes a piece, hits cmd+j, nova continues in his voice, accepts and rejects log correctly, drift toast fires when nova reaches for a corporate word.

## week 3 · reading view + publishing + repurpose
**goal**: pieces publish to `/p/[slug]` looking like print. repurpose drawer compiles to twitter, linkedin, newsletter.

- T-033 reading view route `/p/[slug]` with plate static
- T-034 typography scale + drop cap + sidenotes scaffolding
- T-035 shiki dual-theme code blocks
- T-036 OG image template + route via next/og
- T-037 publish flow + slug uniqueness + status transitions
- T-038 schedule publish via pg-boss + worker
- T-039 unpublish + soft archive
- T-040 subscribers capture + double opt-in via resend
- T-041 compiler prompts (twitter, linkedin, newsletter)
- T-042 repurpose compile endpoint + streaming to compiled_outputs
- T-043 repurpose drawer UI + edit/copy
- T-044 regenerate segment (per-tweet, per-paragraph)
- T-045 print stylesheet

ship: dom publishes a piece, gets a magazine-grade URL, shares it. opens the repurpose drawer, gets a voice-matched thread + linkedin post + newsletter version, copies to clipboard.

## week 4 · polish, observability, deploy
**goal**: launch quality. motion polished, visual regression locked, lighthouse green, deployed on real domain.

- T-046 framer-motion page transitions + reduced-motion fallback
- T-047 visual regression baselines (mobile + desktop, dark + light)
- T-048 e2e critical path (signup → draft → AI → publish → reading view → repurpose)
- T-049 lighthouse-ci wiring + budgets
- T-050 axe-core a11y suite
- T-051 web vitals + posthog wired
- T-052 launch runbook + smoke test on staging

ship: nova.lunari.pro live. dom writes the launch piece in nova itself, publishes it, shares the link. first writer outside of dom signs up.

## post-v1 (planned, not in scope for these four weeks)
- custom domains
- per-user model fine-tuning over the accept/reject log
- collaborative editing via supabase presence
- direct push to twitter/linkedin via oauth
- billing layer
- mobile app shell
