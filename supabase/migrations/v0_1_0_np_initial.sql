-- nova press · v0_1_0_np_initial
-- =====================================================================
-- scope: week 1 only. ships `np_user_settings` + `np_pieces` + one
-- tool_cost_registry seed (`nova_publish_piece`).
--
-- voice corpus, partner conversations, drafting preferences, subscribers,
-- repurpose outputs, and publishing queue ... NOT in this migration.
-- they ship in v0_2_0+ when the AI partner is being wired up.
--
-- substrate: shared lunari supabase project `fpposmirumtbocqtxued`.
-- semver track: nova's own v0.x (not lunari's v17.x).
-- design doc: docs/06-database-design.md.
--
-- shared substrate invariants this migration upholds:
--   - all nova tables prefixed `np_`
--   - cross-product FKs only to `auth.users(id)`
--   - RLS enabled, four-policy CRUD on `auth.uid() = user_id` (atlas pattern)
--   - reuses existing public.tg_set_updated_at() (security definer, hardened),
--     does not redefine
--   - inserts into existing `tool_cost_registry` with surface='nova_press'
-- =====================================================================


-- ---------------------------------------------------------------------
-- np_user_settings
-- per-user nova preferences (typewriter mode, partner aggressiveness,
-- default share visibility, default repurpose channels).
-- ---------------------------------------------------------------------
CREATE TABLE np_user_settings (
  user_id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  typewriter_mode            boolean NOT NULL DEFAULT false,
  focus_mode_default         boolean NOT NULL DEFAULT false,
  partner_aggressiveness     smallint NOT NULL DEFAULT 2 CHECK (partner_aggressiveness BETWEEN 0 AND 3),
  default_share_visibility   text NOT NULL DEFAULT 'private' CHECK (default_share_visibility IN ('private','unlisted','public')),
  default_repurpose_channels text[] NOT NULL DEFAULT '{}',
  preferences                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE np_user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_user_settings_select_own ON np_user_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_user_settings_insert_own ON np_user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_user_settings_update_own ON np_user_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_user_settings_delete_own ON np_user_settings
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_user_settings_set_updated_at
  BEFORE UPDATE ON np_user_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_user_settings IS
  'Nova Press per-user preferences (typewriter mode, partner aggressiveness, default share visibility, default repurpose channels). RLS owner-only.';


-- ---------------------------------------------------------------------
-- np_pieces
-- source of truth for a writer''s piece. body is a plate v49 Value (jsonb).
-- drafts share this table via status=''draft''.
-- slug is globally unique among published pieces (partial unique index)
-- since /p/[slug] is a global namespace.
-- ---------------------------------------------------------------------
CREATE TABLE np_pieces (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug                   text,
  title                  text NOT NULL DEFAULT 'untitled',
  body                   jsonb NOT NULL DEFAULT '[]'::jsonb,
  excerpt                text,
  word_count             integer NOT NULL DEFAULT 0,
  status                 text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled','archived')),
  visibility             text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','unlisted','public')),
  published_at           timestamptz,
  scheduled_publish_at   timestamptz,
  last_autosaved_at      timestamptz NOT NULL DEFAULT now(),
  last_edited_at         timestamptz NOT NULL DEFAULT now(),
  repurpose_history      jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- one slug per published piece (drafts may share / have null slug)
CREATE UNIQUE INDEX np_pieces_published_slug_uniq
  ON np_pieces (slug)
  WHERE status = 'published' AND slug IS NOT NULL;

-- library page: list user''s pieces sorted by recency, filtered by status
CREATE INDEX np_pieces_user_status_updated_idx
  ON np_pieces (user_id, status, last_edited_at DESC);

-- library page: published-only view
CREATE INDEX np_pieces_user_published_idx
  ON np_pieces (user_id, published_at DESC)
  WHERE published_at IS NOT NULL;

-- pg-boss worker scan: due scheduled publishes
CREATE INDEX np_pieces_scheduled_idx
  ON np_pieces (scheduled_publish_at)
  WHERE status = 'scheduled';

ALTER TABLE np_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_pieces_select_own ON np_pieces
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_pieces_insert_own ON np_pieces
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_pieces_update_own ON np_pieces
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_pieces_delete_own ON np_pieces
  FOR DELETE USING (auth.uid() = user_id);

-- note: no public-read policy. /p/[slug] reading view loads via server-side
-- service role and filters on (status='published' AND visibility IN ('unlisted','public')),
-- returning only public-safe fields. bypassing RLS at the right boundary,
-- not weakening it.

CREATE TRIGGER np_pieces_set_updated_at
  BEFORE UPDATE ON np_pieces
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_pieces IS
  'Nova Press writing pieces. body is plate v49 Value (jsonb). drafts share this table via status=draft. slug globally unique among published. RLS owner-only; public read goes through service-role server fetch.';


-- ---------------------------------------------------------------------
-- tool_cost_registry seed (existing shared table; nova adds one row)
-- only seed needed for week 1: nova_publish_piece.
-- nova_partner_chat, nova_voice_embed, nova_voice_search,
-- nova_repurpose_compile come with v0_2_0 / v0_3_0 / v0_6_0.
-- ---------------------------------------------------------------------
INSERT INTO tool_cost_registry (
  tool_name,
  display_name,
  category,
  surface,
  owner_agent,
  fuel_cost,
  fuel_cost_dynamic,
  dynamic_formula,
  compute_cost_usd_basis,
  primary_model_slug,
  cost_notes,
  description,
  introduced_version,
  active
) VALUES (
  'nova_publish_piece',
  'Nova Publish Piece',
  'publish',
  'nova_press',
  'nova-publish',
  0.00,
  false,
  NULL,
  0.00,
  NULL,
  'Free tool: no vendor API. Slug insert + queue row only.',
  'Publishes a Nova Press piece to /p/[slug].',
  'np_v0.1.0',
  true
) ON CONFLICT (tool_name) DO NOTHING;
