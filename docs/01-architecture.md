# nova press · architecture

## stack
- next.js 15 (app router) + react 19 + typescript strict
- tailwind 3.4 + shadcn/ui primitives + lunari design tokens
- plate (`@udecode/plate*`) as editor spine
- vercel AI SDK (`ai` + `@ai-sdk/anthropic`) for AI partner
- supabase (postgres + auth + storage + realtime + pgvector) for data
- voyage-3-large (1024d) for voice corpus embeddings
- pg-boss for scheduled publishing + repurpose compile jobs
- resend for subscriber confirmation email
- shiki for code highlighting, katex for math
- railway for backend workers, netlify for frontend

## module map

```
src/
├── app/                       # next app router routes
│   ├── page.tsx               # landing
│   ├── editor/[id]/page.tsx   # writing room (client + server split)
│   ├── p/[slug]/page.tsx      # published reading view (RSC, no editor bundle)
│   ├── settings/              # publication + voice corpus + integrations
│   └── api/                   # route handlers + AI sdk streams
│
├── components/
│   ├── ui/                    # shadcn primitives
│   ├── editor/                # plate-shell, slash menu, bubble toolbar, partner rail, ghost text
│   ├── reading/               # drop cap, sidenote, share row, subscribe block
│   └── ai/                    # partner chat, voice-check toast, repurpose drawer
│
├── lib/
│   ├── ai/                    # claude client, prompts, voice-mirror, safety
│   ├── db/                    # supabase server + browser clients, typed queries
│   ├── voice/                 # tokenize, metrics, embed, retrieve, drift, compact
│   ├── repurpose/             # per-platform compilers
│   ├── jobs/                  # pg-boss client, job definitions, runner
│   ├── og/                    # OG image template (next/og)
│   ├── flow/                  # flow state detector
│   └── utils.ts               # cn() + small helpers
│
├── styles/                    # tokens.css, globals.css
└── types/                     # database types (gen'd), api types, plate types
```

## data flow ... write to publish

```
user types → plate editor (client) → onChange → useAutosave hook
   ↓ 1500ms debounce
   POST /api/revisions {piece_id, content_json, created_by:'autosave'}
   ↓
   supabase insert into revisions; update pieces.content_json + updated_at
   ↓
   chip updates "saved 3s ago"

user invokes /continue → plate AIKit calls AIChatPlugin.chatOptions.api
   ↓
   POST /api/ai/command {command:'continue', piece_id, context_text, ...}
   ↓
   server reads voice_profiles + retrieves top-3 voice_embeddings by cosine to query
   ↓
   builds system prompt: identity + voice rules + compact view + forbidden-preamble + exemplars + recent context
   ↓
   streamText() via @ai-sdk/anthropic (claude sonnet 4.5)
   ↓
   server enforces one-sentence truncation + voice audit
   ↓
   SSE stream → plate ghost text renders
   ↓
   user accepts/rejects → POST /api/accept-reject log entry

user publishes → POST /api/publish {piece_id, scheduled_for?}
   ↓
   if scheduled: pg-boss.send('publish-piece', {piece_id, scheduled_for})
   if now: status=published, generate OG via next/og, notify subscribers (deferred)
   ↓
   /p/[slug] now resolves publicly (RLS allows anon on status=published)

user repurposes → POST /api/repurpose/compile {piece_id, platform:'twitter'}
   ↓
   pg-boss.send('compile-output', {piece_id, platform})
   ↓
   worker loads voice_profile + source_md + platform prompt → streamText → compiled_outputs insert
   ↓
   realtime broadcast piece:<id>:repurpose → drawer updates
```

## supabase schema (v1 sketch)

```sql
-- core
profiles (id pk -> auth.users, handle uq, display_name, voice_rules_json, ai_opt_in, ...)
pieces (id pk, user_id, title, slug uq when published, content_json, status, visibility, word_count, reading_time_s, published_at, scheduled_for, ...)
revisions (id pk, piece_id, content_json, created_by enum, created_at)

-- voice
voice_profiles (id pk, user_id uq, profile_json, compact_view, centroid vector(1024), sample_count, status enum, last_trained_at)
voice_samples (id pk, user_id, source enum, title, body, token_count, created_at)
voice_embeddings (id pk, user_id, sample_id, chunk_index, chunk_text, embedding vector(1024), HNSW cosine index)

-- publishing + repurpose
publish_targets (id pk, user_id, kind enum, config_json, oauth_connection_id)
compiled_outputs (id pk, piece_id, platform enum, variant_index, content_json, content_text, status enum, ...)
publish_jobs (id pk, piece_id, target, state enum, scheduled_for, attempts, last_error, pg_boss_id)

-- ai audit
ai_invocations (id pk, user_id, piece_id, command enum, model, temperature, input_tokens, output_tokens, cost_usd, latency_ms, status enum, ...)
accept_reject_log (id pk, invocation_id, user_id, accepted bool, edit_distance_after, time_to_accept_ms, voice_match_score)

-- social (later)
subscribers (id pk, author_id, email, confirmed_at, ...)
oauth_connections (id pk, user_id, provider enum, access_token enc, refresh_token, expires_at)
```

RLS: every owned table policies are `(select auth.uid()) = user_id` for owner CRUD; `pieces` has a public read policy where `status='published' and visibility='public'`. all owned-tables policies use `(select auth.uid())` wrapped form so postgres caches per statement.

## key invariants
- every AI call goes through `src/lib/ai/`. no direct `streamText` in route handlers or components
- every DB read/write goes through `src/lib/db/queries/`. no raw supabase calls in routes
- voice profile compact view MUST be injected in every prompt
- editor bundle does NOT ship to `/p/[slug]` ... use plate static rendering or a manual serializer
- pg-boss schema is separate from the app schema in supabase ... wrap with advisory locks to avoid double-publish

## the realtime channels
- `piece:<id>:autosave` ... cross-tab autosave conflict signals (later)
- `piece:<id>:repurpose` ... compile progress for the repurpose drawer
- `piece:<id>:publish` ... publish job state transitions
