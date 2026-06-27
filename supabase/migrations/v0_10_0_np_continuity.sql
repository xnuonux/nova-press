-- nova press · v0_10_0_np_continuity
-- =====================================================================
-- scope: the continuity layer's STORAGE (the schema). the model + the scan
-- logic land in 4.2; this is the two tables they write.
--
--   - np_continuity_flags ... one continuity concern raised over a work: a
--     contradiction (a fact the prose breaks), an unintroduced mention (a
--     name used before it's established), a timeline slip, a name-drift
--     ("marrik" where the bible says "marik"). a flag mirrors the editorial
--     Finding's shape: a descriptive message + a triage status (open ->
--     accepted | dismissed), so the continuity rail reuses the pass-panel
--     ergonomics. work / piece / entity pointers are PLAIN uuid (the
--     exit-ramp spine): a flag is self-describing in its message, so a
--     deleted target leaves a harmless orphan the app prunes ... no FK
--     cascade (unlike the bible's own knowledge graph in v0_9_0).
--
--   - np_continuity_scans ... the resumable scan watermark per work, cloning
--     the np_newsletter_dispatch two-phase pattern (v0_6_0): keyed on
--     (work_id, body_hash), status walks preview -> in_progress -> complete,
--     a server-minted scan_token gates the commit. a scan over an UNCHANGED
--     work is the same row (skip the re-scan); editing the work is a new
--     hash = a new scan that legitimately runs. a crash mid-scan leaves the
--     row in_progress (RESUMABLE), never a 'complete' that lies.
--
-- substrate invariants upheld: np_ prefix; cross-product FK only to
-- auth.users(id); all intra-nova pointers plain uuid; RLS four-policy owner;
-- reuses public.tg_set_updated_at(); nova's own v0.x.
-- =====================================================================

-- ---------------------------------------------------------------------
-- np_continuity_flags
-- the descriptive concerns the scan raises. status mirrors the editorial
-- Finding triage (open|accepted|dismissed) so the continuity rail reuses the
-- pass-panel triage. work_id / piece_id / entity_id are plain uuid (no FK):
-- the message stands alone, so an orphaned flag is harmless + app-pruned.
-- scope jsonb carries the block / range / mention span the flag points at.
-- ---------------------------------------------------------------------
CREATE TABLE np_continuity_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalized so RLS is a column compare
  work_id     uuid NOT NULL,                       -- plain uuid -> np_works
  piece_id    uuid,                                -- plain uuid -> np_pieces (where the concern surfaced), nullable
  entity_id   uuid,                                -- plain uuid -> np_bible_entities (the noun involved), nullable
  kind        text NOT NULL DEFAULT 'contradiction'
                CHECK (kind IN ('contradiction','unintroduced','timeline','name_drift','other')),
  message     text NOT NULL,                       -- descriptive, lowercase, in voice ... a mirror, never a verdict
  status      text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','accepted','dismissed')),
  scope       jsonb NOT NULL DEFAULT '{}'::jsonb,  -- the block / range / mention span the flag points at
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- the continuity rail: a work's OPEN flags first
CREATE INDEX np_continuity_flags_work_status_idx ON np_continuity_flags (work_id, status);
-- the per-piece inbox (flags raised in this piece)
CREATE INDEX np_continuity_flags_piece_idx ON np_continuity_flags (piece_id) WHERE piece_id IS NOT NULL;

ALTER TABLE np_continuity_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_continuity_flags_select_own ON np_continuity_flags
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_continuity_flags_insert_own ON np_continuity_flags
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_continuity_flags_update_own ON np_continuity_flags
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_continuity_flags_delete_own ON np_continuity_flags
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_continuity_flags_set_updated_at
  BEFORE UPDATE ON np_continuity_flags
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_continuity_flags IS
  'nova press continuity flags ... descriptive concerns the scan raises over a work (contradiction|unintroduced|timeline|name_drift). status mirrors the editorial Finding triage (open|accepted|dismissed). plain-uuid work/piece/entity pointers (self-describing message; orphans harmless + app-pruned). rls owner-only.';


-- ---------------------------------------------------------------------
-- np_continuity_scans
-- the resumable scan watermark per work, two-phase like np_newsletter_dispatch.
-- keyed on (work_id, body_hash): a scan of an unchanged work is the same row
-- (skip); an edited work is a new hash = a new scan. status walks preview ->
-- in_progress -> complete; a crash leaves it in_progress (resumable), never a
-- 'complete' that lies. scan_token is server-minted at preview + required to
-- commit, so no future caller reaches the model spend without THIS scan being
-- approved. flags_found is the result tally.
-- ---------------------------------------------------------------------
CREATE TABLE np_continuity_scans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_id       uuid NOT NULL,                     -- plain uuid -> np_works
  body_hash     text NOT NULL,                     -- hash of the work's scanned content (the staleness key)
  status        text NOT NULL DEFAULT 'preview'
                  CHECK (status IN ('preview','in_progress','complete')),
  scan_token    uuid NOT NULL DEFAULT gen_random_uuid(),
  flags_found   integer NOT NULL DEFAULT 0,
  scan_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,  -- model / token / phase cursor, extensible
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

-- one scan per (work, exact content). a re-scan of the same body returns the
-- same row; an edited work is a new hash = a new scan.
CREATE UNIQUE INDEX np_continuity_scans_work_hash_uniq
  ON np_continuity_scans (work_id, body_hash);
-- the commit step looks the scan up by its server-minted token.
CREATE UNIQUE INDEX np_continuity_scans_token_uniq
  ON np_continuity_scans (scan_token);
CREATE INDEX np_continuity_scans_work_created_idx
  ON np_continuity_scans (work_id, created_at DESC);

ALTER TABLE np_continuity_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_continuity_scans_select_own ON np_continuity_scans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_continuity_scans_insert_own ON np_continuity_scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_continuity_scans_update_own ON np_continuity_scans
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_continuity_scans_delete_own ON np_continuity_scans
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_continuity_scans_set_updated_at
  BEFORE UPDATE ON np_continuity_scans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_continuity_scans IS
  'nova press continuity scan watermark, two-phase + resumable (the np_newsletter_dispatch pattern). UNIQUE(work_id, body_hash) skips a re-scan of unchanged content while an edit is a new hash = a new scan. status preview->in_progress->complete (a crash stays in_progress, never a false complete). scan_token gates the commit. rls owner-only.';
