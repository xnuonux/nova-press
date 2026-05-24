# nova press · database design (v1 proposal)

> nova press lives in the shared LUNARI supabase project (`fpposmirumtbocqtxued`) as one product surface among others (cinema, factory i, gen connect). this doc proposes the `np_*` schema for v1.
>
> status: **DRAFT for strategy redline.** no migrations written yet.
> last updated: 2026-05-22 · claude code session · v1 (folds in strategy's v17_8_6 shared-substrate decisions)

---

## 1. invariants (non-negotiable)

- every nova table is prefixed `np_`
- cross-product foreign keys are limited to `auth.users(id) ON DELETE CASCADE` and `voice_profiles(user_id)`. nothing else.
- nova does NOT FK to `public.user_core` (that's LUNARI's consciousness profile, not nova's concern)
- RLS is enabled on every `np_*` table
- the RLS policy template is the four-policy CRUD set on `auth.uid() = user_id` (atlas pattern)
- migration files are named `vX_Y_Z_np_<feature>.sql`, starting at nova's own `v0.1.0` track (nova has its own semver, NOT on LUNARI's v17.x line)
- nova's service role key is SEPARATE from lunari's (rotated independently)
- standalone exit ramp: `pg_dump --table='np_*' --table='voice_profiles' --table='user_profiles' --schema=public ...`
- **shared substrate column ownership** is enforced at the app layer (RLS can't gate columns). nova writes only to columns the v17_8_6 comments mark "WRITTEN BY NOVA PRESS ONLY", appends to `extraction_history`, and may last-writer-wins on base voice columns. nova NEVER touches outreach_*, is_lunari_*, is_factory_*, is_gen_connect_only, is_lunari_company.

---

## 2. research summary (what informed the design)

| finding | source | applied as |
|---|---|---|
| `auth.users(id)` is the cross-product FK target, with `raw_app_meta_data jsonb` for app-controlled flags | `auth.users` columns | every np_* FKs to auth.users; surface flag proposal uses raw_app_meta_data |
| `user_core` is LUNARI-specific (wavefunction_phase, self_narrative, etc.) and is NOT FK-backed against auth.users | FK constraints scan | nova never references user_core |
| `voice_presets` is cinema's ElevenLabs TTS presets | column shape + settings jsonb defaults | nova's writing-voice tables use `np_voice_*` prefix to avoid confusion |
| atlas uses flex-dim `vector` + `embedding_model` + `embedding_dimensions` columns | `decision_packets` shape | nova matches it ... can swap voyage for openai without column migration |
| atlas RLS uses explicit four-policy CRUD, no service-role-bypass policy (service role bypasses RLS via BYPASSRLS attribute) | `decision_packets` policies | nova adopts this; conversations' bypass policy is redundant |
| HNSW with `m=16, ef_construction=64` and cosine ops is the atlas template | `decision_packets_embedding_hnsw_idx` | nova uses the same index params |
| `tool_cost_registry` already has a `surface text NOT NULL` column for product partitioning | column shape | nova seeds rows with `surface='nova_press'`, no new fuel tables |
| `fuel_usage` is the per-action billing log; RLS is "service role only" (no policies = deny non-service-role) | column shape + RLS policies | nova writes to fuel_usage from server-side via service role |
| `agent_learnings` is a great per-agent learning store BUT has `public_read qual: true` (any user reads any learning) | RLS policies | nova's drafting-preferences table uses strict `auth.uid() = user_id`, no public read |
| `agent_actions.rating smallint` with comment "-1=down, 0=neutral, 1=up" | column comments | nova reuses exact shape on partner suggestion feedback |
| `project_file_chunks` has chunk_index + chunk_text + char/line positions but NO embedding column (structural chunking only) | column scan | nova borrows the chunking shape, adds a separate embeddings table |

---

## 3. open questions (Q2 + Q3 RESOLVED by v17_8_6; Q1 + Q4 still open)

**Q1 (still open): `user_core.voice_signature jsonb` ... does nova write here?**
the column already exists, empty default `{}`. with `voice_profiles` now shipped as the canonical source of truth, `voice_signature` may be vestigial. **assuming (c) ignore it** ... nova writes voice data to shared `voice_profiles` and leaves `voice_signature` alone. doesn't block v1; should be answered before the partner integration ships in week 2.

**Q2 (RESOLVED by v17_8_6): voice_profiles is live.**
- table: `public.voice_profiles`, PK = `user_id`, one row per user
- nova reads + writes per the column-ownership protocol (section 5)
- no `voice_profile_id` FK is needed on `np_voice_corpus_chunks` ... the user_id chain (chunks → auth.users ← voice_profiles) already binds them. join on `user_id` when needed.

**Q3 (RESOLVED by v17_8_6): surface flag lives on `public.user_profiles.is_nova_press_only` (boolean column).**
- nova writes this column ONLY. never touches `is_lunari_user`, `is_gen_connect_only`, `is_lunari_company`, or anything else on user_profiles that isn't its own.
- nova ALSO writes `signup_surface = 'nova_press'` on the user_profiles row at magic-link signup time.
- the jsonb-on-auth.users path is dropped. column-on-shared-table wins for queryability + indexability + joinability.

**Q4 (still open): embedding column dimensioning ... flex vs fixed?**
atlas precedent: flex-dim `vector` + `embedding_model` + `embedding_dimensions` as separate metadata columns. **proceeding with flex per atlas** unless strategy redirects. lets us swap voyage-3 for voyage-3-large or openai `text-embedding-3-small` without a column-type migration.

---

## 4. what nova does NOT create

deliberately, to keep the substrate single-sourced:

- **no fuel tables** ... reuse `fuel_usage`
- **no tool cost tables** ... add seed rows to existing `tool_cost_registry` with `surface='nova_press'`
- **no pgboss tables** ... pg-boss creates its own `pgboss` schema on init; we just initialize it
- **no auth tables** ... gotrue owns `auth.users`
- **no `voice_profiles` table** ... v17_8_6 shipped it; nova reads + writes nova-owned columns per the column-ownership protocol
- **no `user_profiles` table** ... v17_8_6 shipped it; nova writes its own surface flag (`is_nova_press_only`) + `signup_surface` only
- **no `tg_set_updated_at()` trigger function** ... v17_8_6 shipped a hardened version (`SECURITY DEFINER SET search_path = pg_catalog, public`). nova attaches it to its `updated_at` columns rather than defining its own.

### 4.1 shared substrate column ownership (CRITICAL, app-enforced)

RLS gates rows, not columns. column-level discipline is enforced by nova's app code. column comments on `voice_profiles` + `user_profiles` document ownership so any future session can self-verify.

**on `public.user_profiles` (one row per user):**
| column | who writes | nova action |
|---|---|---|
| `user_id` | server (signup trigger or app) | INSERT on magic-link signup |
| `is_nova_press_only` | **NOVA ONLY** | set TRUE on signup; flip FALSE if LUNARI activates user |
| `signup_surface` | the surface where the user signed up | set `'nova_press'` on nova signup |
| `signup_at` | server | DEFAULT now() |
| `is_lunari_user`, `is_gen_connect_only`, `is_lunari_company` | their respective owners | **NOVA NEVER TOUCHES** |
| `schema_version`, `created_at`, `updated_at` | system | n/a |

**on `public.voice_profiles` (one row per user, PK = user_id):**
| column | who writes | nova action |
|---|---|---|
| `writing_overrides jsonb` | **NOVA ONLY** | nova's writing-context voice tweaks (paragraph length, header style, reading pace) |
| `writing_samples_count int` | **NOVA ONLY** | increment when nova ingests new writing samples |
| `active_for_writing bool` | **NOVA ONLY** | activation gate for the writing partner |
| `extraction_history jsonb` | append-only by both products | nova appends `{timestamp, product:'nova_press', model, confidence, base_snapshot}`, then trims to last 5 entries (app-level) |
| base voice cols (`register`, `vocabulary_signature`, `formality_score`, `sentence_length_avg/variance`, `paragraph_length_avg/variance`, `opening_patterns`, `closing_patterns`, `avoided_phrases`, `idiosyncratic_phrases`, `emoji_signature`, `punctuation_style`) | last-writer-wins by both products | nova updates after each extraction; gen connect may overwrite if they extract later |
| `last_extracted_at`, `last_extracted_by`, `extraction_model`, `extraction_confidence` | last extractor | nova sets these on each extraction |
| `source_samples jsonb`, `combined_samples_count` | shared metadata | nova may append to source_samples + recompute combined_samples_count |
| `outreach_overrides`, `outreach_samples_count`, `active_for_outreach` | gen connect only | **NOVA NEVER TOUCHES** |
| `schema_version`, `created_at`, `updated_at` | system | n/a |

---

## 5. table catalogue (v1)

| table | purpose | row scope | retention |
|---|---|---|---|
| `np_user_settings` | per-user nova preferences | one per user | indefinite |
| `np_pieces` | source of truth for a writer's piece (plate body, status, slug, publish state) | per piece | indefinite |
| `np_voice_corpus_sources` | one row per ingested writing sample | per source | indefinite |
| `np_voice_corpus_chunks` | text chunks extracted from sources | per chunk | indefinite |
| `np_voice_corpus_embeddings` | vector embeddings of chunks (flex-dim, atlas shape) | per chunk per model | until re-embed |
| `np_voice_corpus_ingestion_events` | ingestion status log | per event | 90 days (TBD) |
| `np_partner_conversations` | partner conversation containers | per conversation | indefinite |
| `np_partner_messages` | messages within a partner conversation | per message, append-only | indefinite |
| `np_partner_suggestion_feedback` | thumbs up/down on partner output | per feedback, append-only | indefinite |
| `np_drafting_preferences` | per-user learned voice preferences | per preference | indefinite |
| `np_subscribers` | email-list signups, scoped to a writer | per subscriber per writer | indefinite |
| `np_repurpose_outputs` | voice-matched per-channel versions of a piece | per output | indefinite |
| `np_publishing_queue` | scheduled-publish state (pg-boss workers drain it) | per scheduled publish | until processed + 30 days |

deferred to v2 (or later):
- `np_piece_versions` (autosave history beyond last-saved)
- `np_partner_prevention_rules` (post-feedback "don't suggest this again" rules; needs population first)
- `np_subscriber_segments` (audience segmentation)

---

## 6. ddl (sql sketch, draft)

### 6.1 np_user_settings

```sql
CREATE TABLE np_user_settings (
  user_id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  typewriter_mode            boolean NOT NULL DEFAULT false,
  focus_mode_default         boolean NOT NULL DEFAULT false,
  partner_aggressiveness     smallint NOT NULL DEFAULT 2 CHECK (partner_aggressiveness BETWEEN 0 AND 3),
  default_share_visibility   text NOT NULL DEFAULT 'private' CHECK (default_share_visibility IN ('private','unlisted','public')),
  default_repurpose_channels text[] NOT NULL DEFAULT '{}',
  preferences                jsonb NOT NULL DEFAULT '{}',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
```

### 6.2 np_pieces

```sql
CREATE TABLE np_pieces (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug                   text,                       -- nullable for unpublished drafts
  title                  text NOT NULL DEFAULT 'untitled',
  body                   jsonb NOT NULL DEFAULT '[]',  -- plate v49 Value
  excerpt                text,
  word_count             integer NOT NULL DEFAULT 0,
  status                 text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled','archived')),
  visibility             text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','unlisted','public')),
  published_at           timestamptz,
  scheduled_publish_at   timestamptz,
  last_autosaved_at      timestamptz NOT NULL DEFAULT now(),
  last_edited_at         timestamptz NOT NULL DEFAULT now(),
  repurpose_history      jsonb NOT NULL DEFAULT '[]',
  metadata               jsonb NOT NULL DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- slugs only need to be unique among PUBLISHED pieces (drafts can share slugs or have null)
CREATE UNIQUE INDEX np_pieces_published_slug_uniq
  ON np_pieces (slug)
  WHERE status = 'published' AND slug IS NOT NULL;

CREATE INDEX np_pieces_user_status_updated_idx
  ON np_pieces (user_id, status, last_edited_at DESC);

CREATE INDEX np_pieces_user_published_idx
  ON np_pieces (user_id, published_at DESC) WHERE published_at IS NOT NULL;

CREATE INDEX np_pieces_scheduled_idx
  ON np_pieces (scheduled_publish_at) WHERE status = 'scheduled';
```

### 6.3 voice corpus triad + embeddings

```sql
CREATE TABLE np_voice_corpus_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_kind     text NOT NULL CHECK (source_kind IN ('paste','upload','url','import_piece')),
  source_ref      text,                              -- URL, filename, or piece_id (as text)
  title           text NOT NULL,
  raw_char_count  integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'ingesting' CHECK (status IN ('ingesting','chunked','embedded','failed')),
  metadata        jsonb NOT NULL DEFAULT '{}',
  ingested_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX np_voice_corpus_sources_user_idx
  ON np_voice_corpus_sources (user_id, created_at DESC);


CREATE TABLE np_voice_corpus_chunks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id       uuid NOT NULL REFERENCES np_voice_corpus_sources(id) ON DELETE CASCADE,
  chunk_index     integer NOT NULL,
  chunk_text      text NOT NULL,
  char_start      integer,
  char_end        integer,
  token_estimate  integer,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, chunk_index)
);

-- the user_id chain (chunks → auth.users ← voice_profiles) binds chunks to a voice profile.
-- no redundant voice_profile_id column needed; join on user_id when materializing voice context.

CREATE INDEX np_voice_corpus_chunks_user_idx
  ON np_voice_corpus_chunks (user_id, source_id, chunk_index);

CREATE INDEX np_voice_corpus_chunks_text_fts_idx
  ON np_voice_corpus_chunks USING gin (to_tsvector('english', coalesce(chunk_text, '')));


CREATE TABLE np_voice_corpus_embeddings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_id              uuid NOT NULL REFERENCES np_voice_corpus_chunks(id) ON DELETE CASCADE,
  embedding             vector,                      -- flex-dim per atlas pattern
  embedding_model       text NOT NULL,               -- e.g. 'voyage-3', 'voyage-3-large', 'text-embedding-3-small'
  embedding_dimensions  integer NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chunk_id, embedding_model)
);

-- HNSW index per atlas: m=16, ef_construction=64, cosine
CREATE INDEX np_voice_corpus_embeddings_hnsw_idx
  ON np_voice_corpus_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX np_voice_corpus_embeddings_user_model_idx
  ON np_voice_corpus_embeddings (user_id, embedding_model);


CREATE TABLE np_voice_corpus_ingestion_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id       uuid REFERENCES np_voice_corpus_sources(id) ON DELETE CASCADE,
  event_type      text NOT NULL,                     -- 'source_received', 'chunked', 'embedded', 'failed'
  status          text NOT NULL DEFAULT 'complete' CHECK (status IN ('in_progress','complete','error')),
  message         text,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX np_voice_corpus_ingestion_events_user_created_idx
  ON np_voice_corpus_ingestion_events (user_id, created_at DESC);
```

### 6.4 partner conversations + telemetry

```sql
CREATE TABLE np_partner_conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  piece_id     uuid REFERENCES np_pieces(id) ON DELETE SET NULL,
  title        text NOT NULL DEFAULT 'partner session',
  pinned       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX np_partner_conversations_user_updated_idx
  ON np_partner_conversations (user_id, updated_at DESC);


CREATE TABLE np_partner_messages (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id          uuid NOT NULL REFERENCES np_partner_conversations(id) ON DELETE CASCADE,
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                     text NOT NULL CHECK (role IN ('user','partner','system')),
  content                  text NOT NULL,
  model                    text,                     -- 'claude-opus-4-7' for partner messages, null for user
  voice_exemplar_chunk_ids uuid[] NOT NULL DEFAULT '{}',
  prompt_tokens            integer,
  completion_tokens        integer,
  fuel_cost                numeric,
  metadata                 jsonb NOT NULL DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX np_partner_messages_conv_created_idx
  ON np_partner_messages (conversation_id, created_at);


CREATE TABLE np_partner_suggestion_feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid NOT NULL REFERENCES np_partner_messages(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating          smallint NOT NULL CHECK (rating IN (-1, 0, 1)),  -- -1=down, 0=neutral, 1=up per agent_actions
  feedback_text   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN np_partner_suggestion_feedback.rating IS '-1 = thumbs down, 0 = neutral, 1 = thumbs up';

CREATE INDEX np_partner_suggestion_feedback_user_idx
  ON np_partner_suggestion_feedback (user_id, created_at DESC);
```

### 6.5 drafting preferences

```sql
CREATE TABLE np_drafting_preferences (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category          text NOT NULL,                   -- 'tone', 'sentence_length', 'vocab', 'structure', etc.
  preference_text   text NOT NULL,
  source            text NOT NULL DEFAULT 'derived_from_corpus' CHECK (source IN ('explicit','derived_from_feedback','derived_from_corpus')),
  relevance_score   integer NOT NULL DEFAULT 30,
  times_referenced  integer NOT NULL DEFAULT 0,
  last_used_at      timestamptz,
  active            boolean NOT NULL DEFAULT true,
  metadata          jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX np_drafting_preferences_user_active_idx
  ON np_drafting_preferences (user_id, active, relevance_score DESC);
```

### 6.6 subscribers

```sql
CREATE TABLE np_subscribers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  writer_user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text NOT NULL,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','unsubscribed','bounced','spam')),
  confirmation_token  text,
  subscribed_at       timestamptz NOT NULL DEFAULT now(),
  confirmed_at        timestamptz,
  unsubscribed_at     timestamptz,
  source_piece_id     uuid REFERENCES np_pieces(id) ON DELETE SET NULL,
  metadata            jsonb NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX np_subscribers_writer_email_uniq
  ON np_subscribers (writer_user_id, lower(email));

CREATE INDEX np_subscribers_writer_status_idx
  ON np_subscribers (writer_user_id, status);
```

note: in subscribers the writer is the `user_id` for RLS purposes; column is named `writer_user_id` for readability. RLS template binds on `auth.uid() = writer_user_id`.

### 6.7 repurpose outputs

```sql
CREATE TABLE np_repurpose_outputs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_piece_id          uuid NOT NULL REFERENCES np_pieces(id) ON DELETE CASCADE,
  target_channel           text NOT NULL CHECK (target_channel IN ('newsletter','twitter_thread','linkedin_post','instagram_caption','threads_post','blog_summary')),
  body                     text NOT NULL,
  body_jsonb               jsonb NOT NULL DEFAULT '{}',
  status                   text NOT NULL DEFAULT 'drafting' CHECK (status IN ('drafting','draft','approved','published','failed')),
  generated_at             timestamptz,
  approved_at              timestamptz,
  published_at             timestamptz,
  voice_exemplar_chunk_ids uuid[] NOT NULL DEFAULT '{}',
  fuel_cost                numeric,
  metadata                 jsonb NOT NULL DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX np_repurpose_outputs_piece_idx
  ON np_repurpose_outputs (source_piece_id, target_channel);

CREATE INDEX np_repurpose_outputs_user_status_idx
  ON np_repurpose_outputs (user_id, status, updated_at DESC);
```

---

## 7. RLS templates

### 7.1 standard CRUD (most tables)

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY <table>_select_own ON <table>
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY <table>_insert_own ON <table>
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY <table>_update_own ON <table>
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY <table>_delete_own ON <table>
  FOR DELETE USING (auth.uid() = user_id);
```

service role bypasses all of the above via the BYPASSRLS postgres attribute. no explicit bypass policy needed.

### 7.2 append-only (np_partner_messages, np_partner_suggestion_feedback, np_voice_corpus_ingestion_events)

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY <table>_select_own ON <table>
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY <table>_insert_own ON <table>
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- no UPDATE policy, no DELETE policy → immutable from the client
```

### 7.3 subscribers (writer-scoped, not subscriber-scoped)

```sql
ALTER TABLE np_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_subscribers_select_writer ON np_subscribers
  FOR SELECT USING (auth.uid() = writer_user_id);

CREATE POLICY np_subscribers_insert_writer ON np_subscribers
  FOR INSERT WITH CHECK (auth.uid() = writer_user_id);

CREATE POLICY np_subscribers_update_writer ON np_subscribers
  FOR UPDATE USING (auth.uid() = writer_user_id) WITH CHECK (auth.uid() = writer_user_id);

CREATE POLICY np_subscribers_delete_writer ON np_subscribers
  FOR DELETE USING (auth.uid() = writer_user_id);
```

note: the subscriber confirmation flow (clicking the email confirm link) hits a server-side handler that uses the service role to flip `status = 'active'`. no client-side path for subscribers themselves to mutate.

### 7.4 public reading view (`/p/[slug]`)

reading view loads via an unauthenticated server-side fetch, so it uses the service role and bypasses RLS naturally. **no public-read policy added to np_pieces.** the server filters on `status='published' AND visibility IN ('unlisted','public')` and returns only the public fields.

---

## 8. `tool_cost_registry` seed rows (nova adds; existing table)

| tool_name                  | surface     | category        | owner_agent     | primary_model_slug     | fuel_cost | dynamic | dynamic_formula                            |
|---|---|---|---|---|---|---|---|
| `nova_partner_chat`        | nova_press  | ai_chat         | nova-partner    | claude-opus-4-7        | 0.05      | true    | `0.02 + 0.00005 * (prompt_tokens + completion_tokens)` |
| `nova_voice_embed`         | nova_press  | embedding       | nova-corpus     | voyage-3               | 0.01      | true    | `0.005 + 0.000003 * input_tokens`           |
| `nova_voice_search`        | nova_press  | vector_search   | nova-corpus     | (none)                 | 0.00      | false   | (none)                                     |
| `nova_repurpose_compile`   | nova_press  | ai_chat         | nova-repurpose  | claude-opus-4-7        | 0.10      | true    | `0.05 + 0.00005 * (prompt_tokens + completion_tokens)` |
| `nova_publish_piece`       | nova_press  | publish         | nova-publish    | (none)                 | 0.05      | false   | (none)                                     |

formulas are placeholders ... strategy should redline against the existing fuel calibration. the goal is just: nova hooks in, no new table.

---

## 9. indexes (rationale beyond per-table inline)

| index kind | applied to | why |
|---|---|---|
| HNSW cosine (m=16, ef=64) | `np_voice_corpus_embeddings.embedding` | atlas template, high-recall vector retrieval |
| GIN `jsonb_path_ops` | `metadata` columns (selective) | jsonb filter queries, atlas pattern |
| GIN tsvector | `np_voice_corpus_chunks.chunk_text` | fallback fulltext when vector search misses |
| Partial unique | `np_pieces.slug WHERE status='published'` | one slug owns one published piece |
| Composite btree | `(user_id, status, last_edited_at DESC)` | library page sort + filter |
| Partial btree | `(scheduled_publish_at) WHERE status='scheduled'` | pg-boss scan for due publishes |

---

## 10. standalone extraction procedure

if nova ships standalone in the future:

1. provision a new supabase project (`nova-press-standalone` or similar)
2. enable extensions: `vector`, `pgcrypto`
3. mirror the `auth.users` rows for nova-using accounts:
   - export from LUNARI: `SELECT id, email, raw_app_meta_data, created_at FROM auth.users WHERE raw_app_meta_data ? 'surfaces' AND raw_app_meta_data->'surfaces' ? 'nova_press'`
   - import into standalone via gotrue admin API (re-issues passwords or sends invite links per user)
4. dump nova tables: `pg_dump --table='np_*' --table='voice_*' --schema=public --no-owner --no-privileges --data-only ...` for data, plus the schema dump
5. import to standalone, with FKs re-pointed at the new auth.users
6. swap nova's `DATABASE_URL` to the standalone project
7. shut off nova's writes to LUNARI

step 3 is the only non-trivial work. all the rest is mechanical.

---

## 11. migration plan

nova is on its own semver track (`v0.x`), NOT on LUNARI's `v17.x` line. same database, different product, different version arc.

| version | filename | scope |
|---|---|---|
| v0.1.0 | `vYYYYMMDDHHMMSS_v0_1_0_np_foundation.sql` | every np_* table in this doc + RLS + indexes + `tg_set_updated_at` triggers + tool_cost_registry seed rows |
| v0.1.1+ | TBD | follow-ups as week 1.5 ships (auth helpers, library queries), week 2 (partner + voice extraction job + voice_profiles writes), etc. |

note: nova does NOT need a separate migration for the `voice_profiles` FK ... v17_8_6 already shipped that table, and the user_id chain handles association without an explicit FK from chunks.

---

## 12. apply checklist

unblocked:
- [x] strategy shipped `voice_profiles` + `user_profiles` (v17_8_6) ... no longer a blocker
- [x] Q2 + Q3 resolved
- [ ] strategy redlines this doc (folded-in version)
- [ ] strategy answers Q1 (`user_core.voice_signature` ... vestigial or surface-back?)
- [ ] strategy confirms Q4 (flex-dim vector ok)

still blocking apply:
- [ ] dom drops nova-dev service role key in `.env.local` as `SUPABASE_SERVICE_KEY` (already present as empty placeholder)
- [ ] dom drops `SUPABASE_URL` and `SUPABASE_ANON_KEY` for project `fpposmirumtbocqtxued` in `.env.local`
- [ ] dom drops `SENTRY_DSN` in `.env.local` (strategy: wire now, not stub)
- [ ] dom shares eternities inc's existing `ANTHROPIC_API_KEY` in `.env.local` (NOT a new account; nova bills against shared eternities anthropic billing)
- [ ] dom green-lights `apply_migration` via supabase MCP

apply sequence (when green-lit):
- [ ] nova applies `v0_1_0_np_foundation` (cost confirm first; should be $0 since it's DDL on existing project)
- [ ] post-apply: regenerate supabase typescript types via the supabase mcp `generate_typescript_types`, commit to `src/types/supabase.ts`
- [ ] update `CLAUDE.md` with the shared-substrate model, np_ invariant, cross-product FK rule, column-ownership protocol, standalone exit-ramp procedure
- [ ] add an `e2e_check.sql` to the repo that re-runs the verification queries from section 14, so future sessions can re-confirm substrate shape in seconds

---

## 13. what this doc deliberately does NOT cover (yet)

- analytics / observability for nova specifically (assume LUNARI's `analytics_events` is shared)
- rate limiting (assume LUNARI's `rate_limits` is shared)
- email delivery (assume LUNARI's `email_delivery_log` is shared; resend integration is a thin layer)
- abuse / spam / moderation
- gdpr deletion cascade beyond ON DELETE CASCADE on auth.users
- pricing / plan enforcement (assume LUNARI's `pricing_config` is shared)

each gets its own design pass when scoped.

---

## 14. verification queries (rerunnable)

these are the read-only queries this design rests on. rerun any time substrate shape needs to be reconfirmed.

```sql
-- shared substrate tables exist + shape
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('user_profiles', 'voice_profiles')
ORDER BY table_name, ordinal_position;

-- column ownership comments (strategy enforces via comments)
SELECT c.relname AS table_name, a.attname AS column_name,
       col_description(c.oid, a.attnum) AS comment
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('user_profiles', 'voice_profiles')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND col_description(c.oid, a.attnum) IS NOT NULL
ORDER BY c.relname, a.attnum;

-- RLS verification
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('user_profiles', 'voice_profiles')
ORDER BY tablename, policyname;

-- the migration is in the ledger
SELECT * FROM supabase_migrations.schema_migrations
WHERE name LIKE '%voice_profiles%' OR name LIKE '%user_profiles%';
```

---

## 15. revision log

- 2026-05-22 v0 ... initial draft based on read-only discovery. four open questions to strategy.
- 2026-05-22 v1 ... folded in strategy's v17_8_6 (`voice_profiles + user_profiles + shared substrate`). Q2 + Q3 resolved. column ownership protocol added. migration renamed to nova's `v0_1_0` track. redundant `voice_profile_id` removed from chunks. Q1 + Q4 still open but neither blocks v0_1_0 apply.
