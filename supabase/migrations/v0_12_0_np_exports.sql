-- nova press · v0_12_0_np_exports
-- =====================================================================
-- scope: the export LEDGER. every artifact nova sets ... markdown, docx,
-- epub, the typeset pdf ... leaves one quiet row here, so a writer can see
-- what left the studio and when (and the typesetter panel can name the
-- recent ones). the ledger is best-effort by design: a failed ledger write
-- never fails an export (the app treats it as fire-and-forget), and a
-- failed EXPORT still lands a row (status 'failed') so the trail is honest.
--
--   - np_exports ... one row per export attempt. work_id / piece_id are
--     PLAIN uuid (the exit-ramp spine): a deleted work leaves harmless
--     orphan history, no FK cascade, reads are owner-scoped. no artifact
--     bytes are stored ... the file went to the writer's machine; this is
--     the receipt, not the vault.
--
-- substrate invariants upheld: np_ prefix; cross-product FK only to
-- auth.users(id); all intra-nova pointers plain uuid; RLS four-policy
-- owner; reuses public.tg_set_updated_at(); nova's own v0.x.
-- =====================================================================

-- ---------------------------------------------------------------------
-- np_exports
-- the receipt for one export attempt. format is CHECK-bounded to the four
-- artifacts nova can set today; byte_size is the artifact size on success;
-- detail carries the short failure note on a failed row (never a stack).
-- ---------------------------------------------------------------------
CREATE TABLE np_exports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalized so RLS is a column compare
  work_id     uuid,                                   -- plain uuid -> np_works (null for a piece export)
  piece_id    uuid,                                   -- plain uuid -> np_pieces (null for a work export)
  format      text NOT NULL CHECK (format IN ('markdown','docx','epub','pdf')),
  status      text NOT NULL DEFAULT 'complete' CHECK (status IN ('complete','failed')),
  byte_size   integer,                                -- artifact bytes on success, null on failure
  detail      text NOT NULL DEFAULT '',               -- the short failure note, '' when complete
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- "what left the studio lately" ... the panel + any future history view read
-- the writer's rows newest-first.
CREATE INDEX np_exports_user_recent_idx ON np_exports (user_id, created_at DESC);

ALTER TABLE np_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_exports_select_own ON np_exports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_exports_insert_own ON np_exports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_exports_update_own ON np_exports
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_exports_delete_own ON np_exports
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_exports_set_updated_at
  BEFORE UPDATE ON np_exports
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_exports IS
  'nova press export ledger ... one receipt row per export attempt (markdown/docx/epub/pdf), best-effort by design: a ledger miss never fails an export, a failed export still writes an honest failed row. plain-uuid work/piece pointers (no FK; orphan history is harmless). no artifact bytes stored. rls owner-only.';
