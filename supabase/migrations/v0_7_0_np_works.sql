-- nova press · v0_7_0_np_works
-- =====================================================================
-- scope: the mythos keystone. the universal Work / structure-tree model
-- that turns nova from a flat library of pieces into a complete editorial
-- system ... one tree shape that serves a haiku, an essay, a novel, a
-- series, the silmarillion, an encyclopaedia, and a conlang dictionary.
--
-- the one idea: every written thing is a tree of typed units under a form.
--   - np_works   ... the creative container (the project)
--   - np_nodes   ... the recursive structure tree; a leaf carries one of
--                    four payloads: a prose/verse body (piece_id -> np_pieces),
--                    a typed record (jsonb: lexeme / infobox / character),
--                    a sub-work (child_work_id, a series volume), or nothing
--                    (a container / folder).
--   - np_links   ... the document-level cross-reference graph (wiki-links,
--                    see-also, backlinks), plain-uuid + lightweight.
--   + np_pieces gains work_id / node_id / kind so a piece IS a leaf.
--
-- the database stores a universal tree; a typescript form registry
-- (src/lib/forms/registry.ts) is the only thing that knows what a sonnet
-- is. adding a villanelle or a recipe is one object literal, never a
-- migration. typed records (lexeme / infobox / character) live in the
-- node's `record` jsonb, GIN-indexed ... so conlang + encyclopaedia +
-- poetry need zero dedicated tables.
--
-- substrate: shared lunari supabase project `fpposmirumtbocqtxued`.
-- semver track: nova's own v0.x (not lunari's v17.x).
-- design doc: docs/08-editorial-system-architecture.md.
--
-- shared substrate invariants this migration upholds:
--   - all nova tables prefixed `np_`
--   - cross-product FKs only to `auth.users(id)`. intra-nova references
--     (work_id, parent_id, piece_id, node_id) stay PLAIN uuid ... the
--     `np_subscriber.piece_id` convention ... so `pg_dump --table='np_*'`
--     captures the whole graph and the standalone exit ramp stays clean,
--     and reorder / renest is app-managed anyway. (the bible's knowledge
--     graph in v0_9_0 is the ONE place we use real intra-nova FK cascades,
--     on purpose, because dangling edges there corrupt continuity itself.)
--   - RLS enabled, four-policy CRUD on `auth.uid() = user_id` (atlas pattern)
--   - reuses existing public.tg_set_updated_at() (security definer, hardened),
--     does not redefine
--   - additive only: every np_pieces alter is nullable / defaulted, so every
--     existing row stays valid and every existing flow keeps working.
-- =====================================================================


-- ---------------------------------------------------------------------
-- np_works
-- the creative container. a haiku is a Work with one tiny leaf; the
-- silmarillion is a Work with deep nesting; a trilogy is a Work-of-Works
-- via parent_work_id. form_profile is the registry key (app-validated,
-- not a db enum, so the form vocabulary lives in code).
-- ---------------------------------------------------------------------
CREATE TABLE np_works (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                  text NOT NULL DEFAULT 'untitled',
  form_profile           text NOT NULL DEFAULT 'prose',
  family                 text,                       -- cached registry family: poem|prose|reference|collection|script
  slug                   text,
  status                 text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','published','scheduled','archived')),
  visibility             text NOT NULL DEFAULT 'private'
                           CHECK (visibility IN ('private','unlisted','public')),
  parent_work_id         uuid,                       -- series membership (plain uuid -> np_works)
  bible_work_id          uuid,                       -- which work owns the shared bible (a book -> its series)
  canon_mode             text NOT NULL DEFAULT 'canon_only'
                           CHECK (canon_mode IN ('canon_only','include_drafts')),
  root_node_id           uuid,                       -- the tree root (plain uuid -> np_nodes)
  word_count             integer NOT NULL DEFAULT 0, -- subtree rollup cache
  settings               jsonb NOT NULL DEFAULT '{}'::jsonb,  -- per-work form overrides; conlang phonology/grammar payload
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at           timestamptz,
  scheduled_publish_at   timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- one slug per published work (drafts may share / have null slug); /w/[slug] is a global namespace
CREATE UNIQUE INDEX np_works_published_slug_uniq
  ON np_works (slug)
  WHERE status = 'published' AND slug IS NOT NULL;

-- library: a user's works by recency
CREATE INDEX np_works_user_updated_idx
  ON np_works (user_id, updated_at DESC);

-- series membership lookups
CREATE INDEX np_works_parent_idx
  ON np_works (parent_work_id)
  WHERE parent_work_id IS NOT NULL;

ALTER TABLE np_works ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_works_select_own ON np_works
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_works_insert_own ON np_works
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_works_update_own ON np_works
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_works_delete_own ON np_works
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_works_set_updated_at
  BEFORE UPDATE ON np_works
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_works IS
  'Nova Press creative container (the project). form_profile is a registry key; a Work-of-Works is parent_work_id. RLS owner-only; public read of a published work goes through service-role server fetch at /w/[slug].';


-- ---------------------------------------------------------------------
-- np_nodes
-- the recursive structure tree. node_type is app-validated against the
-- form profile (NOT a db enum) so the structure vocabulary lives in code.
-- a leaf carries ONE of four payloads (which slot is filled discriminates
-- the node shape, see shapeOf in src/types/works.ts):
--   - prose/verse : piece_id -> np_pieces (the existing editor, untouched)
--   - record      : record jsonb (a lexeme / infobox / character sheet)
--   - work_ref    : child_work_id -> np_works (a series volume)
--   - container   : none of the above (a part / folder)
-- (a node with BOTH piece_id and a non-empty record is an encyclopaedia
-- article: infobox + prose.)
-- ---------------------------------------------------------------------
CREATE TABLE np_nodes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalized so RLS is a column compare
  work_id        uuid NOT NULL,                       -- plain uuid -> np_works
  parent_id      uuid,                                -- null = root; self-ref plain uuid -> np_nodes
  node_type      text NOT NULL DEFAULT 'section'
                   CHECK (char_length(node_type) BETWEEN 1 AND 40),  -- app-validated vs form profile, not a db enum
  title          text NOT NULL DEFAULT 'untitled',
  position       numeric NOT NULL DEFAULT 0,          -- fractional ordering among siblings (lexorank-style midpoint)
  is_leaf        boolean NOT NULL DEFAULT false,
  piece_id       uuid,                                -- prose/verse leaf -> np_pieces (plain uuid)
  child_work_id  uuid,                                -- work-ref leaf -> np_works (a series volume)
  record         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- typed-field payload (lexeme / infobox / character)
  synopsis       text,                                -- the corkboard card
  canon          boolean NOT NULL DEFAULT true,       -- node-level canon flag (series)
  word_count     integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','archived')),
  node_metadata  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- the binder fetch: a work's whole tree, ordered for restitch client-side
CREATE INDEX np_nodes_tree_idx        ON np_nodes (work_id, parent_id, position);
-- form / type queries (all the lexemes in a language, all the scenes in a book)
CREATE INDEX np_nodes_type_idx        ON np_nodes (work_id, node_type);
-- the leaf <-> piece bridge
CREATE INDEX np_nodes_piece_idx       ON np_nodes (piece_id) WHERE piece_id IS NOT NULL;
-- dictionary headword lookup (the conlang / encyclopaedia on-ramp)
CREATE INDEX np_nodes_headword_idx    ON np_nodes (work_id, lower(record->>'headword')) WHERE record ? 'headword';
-- arbitrary record-field search (infobox fields, lexeme glosses)
CREATE INDEX np_nodes_record_gin      ON np_nodes USING gin (record jsonb_path_ops);

ALTER TABLE np_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_nodes_select_own ON np_nodes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_nodes_insert_own ON np_nodes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_nodes_update_own ON np_nodes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_nodes_delete_own ON np_nodes
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_nodes_set_updated_at
  BEFORE UPDATE ON np_nodes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_nodes IS
  'Nova Press recursive structure tree. node_type app-validated vs the form profile. a leaf carries one of four payloads (piece_id / record / child_work_id / none). plain-uuid spine (no FK cascade) so the pg_dump exit ramp stays clean; tree integrity is app-managed. RLS owner-only.';


-- ---------------------------------------------------------------------
-- np_links
-- the document-level cross-reference graph: wiki-links, see-also,
-- cognate-of, derives-from, appears-in. node -> node, plain-uuid,
-- lightweight ... this is the NAVIGATION plane (backlinks, "what links
-- here"). it is deliberately separate from the bible's KNOWLEDGE graph
-- (entity facts/relations, v0_9_0, FK-internal). a [[wiki-link]] writes a
-- np_links row for navigation; when continuity is on it also writes a
-- np_text_anchor for the appearances index. an unresolved link (a red
-- link) carries target_ref (a headword / slug / href) until it resolves.
-- ---------------------------------------------------------------------
CREATE TABLE np_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_id         uuid NOT NULL,
  source_node_id  uuid NOT NULL,
  target_node_id  uuid,                               -- null = unresolved (a red link)
  target_ref      text,                               -- headword / slug / href when unresolved
  relation        text NOT NULL DEFAULT 'see_also'
                    CHECK (char_length(relation) BETWEEN 1 AND 40),  -- see_also|cross_ref|cognate_of|derives_from|appears_in
  context         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX np_links_source_idx ON np_links (work_id, source_node_id);
CREATE INDEX np_links_target_idx ON np_links (work_id, target_node_id) WHERE target_node_id IS NOT NULL;

ALTER TABLE np_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_links_select_own ON np_links
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_links_insert_own ON np_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_links_update_own ON np_links
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_links_delete_own ON np_links
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_links_set_updated_at
  BEFORE UPDATE ON np_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_links IS
  'Nova Press document-level cross-reference graph (wiki-links, see-also, backlinks). node -> node, plain-uuid. the navigation plane; distinct from the bible knowledge graph (v0_9_0). RLS owner-only.';


-- ---------------------------------------------------------------------
-- np_pieces becomes a leaf
-- additive only: every column nullable / defaulted, so every existing
-- row stays valid and the existing /library + /editor + /p/[slug] flows
-- keep working untouched. np_nodes.piece_id is authoritative; work_id /
-- node_id here are a denormalized cache for the common "which work owns
-- this piece" lookup. `kind` is the content-type discriminator the editor
-- + reading view switch on (the way they already switch on block.type).
-- ---------------------------------------------------------------------
ALTER TABLE np_pieces ADD COLUMN IF NOT EXISTS work_id uuid;
ALTER TABLE np_pieces ADD COLUMN IF NOT EXISTS node_id uuid;
ALTER TABLE np_pieces ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'prose'
  CHECK (kind IN ('prose','poem','chapter','scene','entry','lexeme','article','outline','note','screenplay'));

CREATE INDEX IF NOT EXISTS np_pieces_work_idx ON np_pieces (work_id) WHERE work_id IS NOT NULL;

COMMENT ON COLUMN np_pieces.kind IS
  'Content-type discriminator for a piece-as-leaf (prose|poem|chapter|scene|entry|lexeme|article|outline|note|screenplay). the editor + reading view switch on it. publication lifecycle stays in status; craft lifecycle (drafting->...->exported) lands in v0_8_0 editorial_stage.';
