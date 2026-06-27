-- nova press · v0_9_0_np_bible
-- =====================================================================
-- scope: the world bible ... the codex. the place a writer's invented
-- world is recorded so nova can keep it CONSISTENT: who the characters
-- are, what's true of them, where places sit, what's been established. it
-- is the knowledge layer the ai author reads (a drafted beat / coined line
-- stays in-world) and the continuity scan (v0_10_0) reads against.
--
--   - np_bible_entities ... the nouns of the world (a character, a place,
--     an object, a faction, an event, a piece of lore). work-scoped so a
--     book OR a series can own one; name + summary + a metadata jsonb.
--   - np_bible_aliases  ... the names an entity answers to ("the ferryman"
--     + "old marik" resolve to one entity), so a fuzzy mention in the prose
--     finds its entity.
--   - np_bible_facts    ... the established truths about an entity, each
--     optionally sourced to the piece that established it.
--
-- THE FK EXCEPTION (foreshadowed in v0_7_0): nova's spine is plain-uuid
-- (no FK cascade) so the pg_dump --table='np_*' exit ramp stays clean. the
-- bible's KNOWLEDGE graph is the deliberate exception: aliases + facts FK
-- their entity ON DELETE CASCADE, on purpose, because a dangling alias /
-- fact corrupts continuity itself (it would assert a truth about a noun
-- that no longer exists). the pg_dump ramp still captures the whole graph
-- (all three tables match np_*), and the cascades are intra-nova only ...
-- the only cross-product FK remains auth.users(id).
--
-- pg_trgm (already enabled on the substrate) powers the fuzzy name + alias
-- match the 4.2 continuity scan needs ("marrik" -> "marik"). gin trigram
-- indexes on the lowered name + alias.
--
-- substrate invariants upheld: np_ prefix; cross-product FK only to
-- auth.users(id); RLS four-policy owner on every table; reuses the existing
-- public.tg_set_updated_at() trigger, never redefined; nova's own v0.x.
-- =====================================================================

-- fuzzy entity-name matching for the continuity scan. idempotent; already
-- enabled on the shared substrate, declared here so the migration is whole.
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ---------------------------------------------------------------------
-- np_bible_entities
-- the nouns of the invented world. work_id is the bible-owning work (a book
-- or, for a series, the work named by np_works.bible_work_id) ... a plain
-- uuid -> np_works, the exit-ramp spine. kind is CHECK-bounded to the codex
-- categories. summary is the one-line "who/what is this"; metadata carries
-- anything structured a form wants (a character's pronouns, a place's region).
-- ---------------------------------------------------------------------
CREATE TABLE np_bible_entities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalized so RLS is a column compare
  work_id     uuid NOT NULL,                       -- plain uuid -> np_works (the bible-owning work)
  name        text NOT NULL,
  kind        text NOT NULL DEFAULT 'character'
                CHECK (kind IN ('character','place','object','faction','event','lore','other')),
  summary     text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- the bible fetch: a work's entities (the author-prompt + the codex view)
CREATE INDEX np_bible_entities_work_idx ON np_bible_entities (work_id);
-- fuzzy name match for the continuity scan ("marrik" ~ "marik")
CREATE INDEX np_bible_entities_name_trgm ON np_bible_entities USING gin (lower(name) gin_trgm_ops);

ALTER TABLE np_bible_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_bible_entities_select_own ON np_bible_entities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_bible_entities_insert_own ON np_bible_entities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_bible_entities_update_own ON np_bible_entities
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_bible_entities_delete_own ON np_bible_entities
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_bible_entities_set_updated_at
  BEFORE UPDATE ON np_bible_entities
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_bible_entities IS
  'nova press world bible entities (the codex nouns: character|place|object|faction|event|lore). work-scoped (a book or a series'' bible work, plain-uuid work_id). read by the ai author (in-world generation) + the continuity scan. rls owner-only.';


-- ---------------------------------------------------------------------
-- np_bible_aliases
-- the names an entity answers to, so a mention in the prose resolves to one
-- entity. entity_id FK ON DELETE CASCADE (the deliberate bible-graph
-- exception): an alias of a deleted entity is meaningless and must go with
-- it. user_id is denormalized for the RLS column compare. a fuzzy trigram
-- index powers "old marrik" -> "old marik".
-- ---------------------------------------------------------------------
CREATE TABLE np_bible_aliases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id   uuid NOT NULL REFERENCES np_bible_entities(id) ON DELETE CASCADE,  -- the bible-graph FK cascade
  alias       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- one alias string per entity (case-insensitive); a re-add is idempotent
CREATE UNIQUE INDEX np_bible_aliases_entity_alias_uniq
  ON np_bible_aliases (entity_id, lower(alias));
CREATE INDEX np_bible_aliases_alias_trgm ON np_bible_aliases USING gin (lower(alias) gin_trgm_ops);

ALTER TABLE np_bible_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_bible_aliases_select_own ON np_bible_aliases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_bible_aliases_insert_own ON np_bible_aliases
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_bible_aliases_update_own ON np_bible_aliases
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_bible_aliases_delete_own ON np_bible_aliases
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_bible_aliases_set_updated_at
  BEFORE UPDATE ON np_bible_aliases
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_bible_aliases IS
  'nova press bible aliases ... the names an entity answers to (one entity, many names). entity_id FK ON DELETE CASCADE (the deliberate bible-knowledge-graph exception to the plain-uuid spine). trigram-indexed for fuzzy resolution. rls owner-only.';


-- ---------------------------------------------------------------------
-- np_bible_facts
-- the established truths about an entity ("the ferryman has never spoken").
-- entity_id FK ON DELETE CASCADE (the bible-graph exception). source_piece_id
-- is a PLAIN uuid (nullable) -> np_pieces: where the fact was established, for
-- the "established in chapter 3" backtrace; plain-uuid because a deleted source
-- piece leaves a still-true fact (only the citation goes stale), so no cascade.
-- ---------------------------------------------------------------------
CREATE TABLE np_bible_facts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id        uuid NOT NULL REFERENCES np_bible_entities(id) ON DELETE CASCADE,  -- the bible-graph FK cascade
  fact             text NOT NULL,
  source_piece_id  uuid,                            -- plain uuid -> np_pieces (where it was established), nullable
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX np_bible_facts_entity_idx ON np_bible_facts (entity_id);

ALTER TABLE np_bible_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_bible_facts_select_own ON np_bible_facts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_bible_facts_insert_own ON np_bible_facts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_bible_facts_update_own ON np_bible_facts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_bible_facts_delete_own ON np_bible_facts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_bible_facts_set_updated_at
  BEFORE UPDATE ON np_bible_facts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_bible_facts IS
  'nova press bible facts ... the established truths about an entity, each optionally sourced to the piece that established it (source_piece_id, plain uuid, no cascade ... a fact outlives its citation). entity_id FK ON DELETE CASCADE (the bible-graph exception). rls owner-only.';
