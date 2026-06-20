-- nova press · v0_6_0_np_newsletter_dispatch
-- =====================================================================
-- the distribution loop, part 3: the blast itself, made impossible to fire
-- twice or fire silently.
--
-- a "dispatch" is one writer-commanded send of one EDITION of a piece's
-- newsletter to its confirmed subscribers. it is two-phase and resumable, and
-- it is keyed on (piece_id, body_hash):
--   - body_hash is a hash of the exact subject+body being sent. re-sending the
--     SAME edition is blocked (the unique index); editing the piece, refreshing
--     the newsletter, and sending the corrected edition is a NEW hash = a NEW
--     dispatch that legitimately goes out. so "no double-blast of this edition"
--     and "i can send the fixed version" are both true.
--   - status walks preview -> in_progress -> complete. a crash mid-blast leaves
--     the row in_progress (RESUMABLE), never a 'complete' that lies. only
--     'complete' returns the hard "already sent" block.
--   - send_token is server-minted at preview time and required to commit, so no
--     caller (a future pg-boss worker, a 'publish and notify' wrapper, a
--     refactor) can reach the actual send without a human approving THIS edition
--     and THIS recipient count. the commit re-derives the hash + count and
--     rejects if either drifted since preview (closes the TOCTOU).
--
-- the per-recipient idempotency unit is the partial unique on np_email_log
-- (dispatch_id, lower(to_email)) from v0_5_0: the send loop attempt-inserts a
-- 'queued' log row first (a 23505 means already reached -> skip), sends, then
-- updates the row to sent/stubbed/failed. so a resume / retry mechanically skips
-- anyone already mailed ... exactly-once per recipient, even across two
-- concurrent resumers.
--
-- substrate invariants upheld: np_ prefix; FK only to auth.users(id); piece_id
-- a plain uuid; RLS four-policy owner; reuses tg_set_updated_at(). v0.6.0.
-- =====================================================================

-- np_email_log gains a 'queued' state so a recipient can be CLAIMED (unique-gated)
-- before the send, then settled. widen the named check in one statement.
ALTER TABLE np_email_log
  DROP CONSTRAINT IF EXISTS np_email_log_status_check,
  ADD CONSTRAINT np_email_log_status_check
    CHECK (status IN ('queued', 'sent', 'stubbed', 'failed'));

CREATE TABLE IF NOT EXISTS np_newsletter_dispatch (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  piece_id        uuid NOT NULL,
  body_hash       text NOT NULL,
  subject         text NOT NULL,
  status          text NOT NULL DEFAULT 'preview'
                    CHECK (status IN ('preview', 'in_progress', 'complete')),
  send_token      uuid NOT NULL DEFAULT gen_random_uuid(),
  attempted_count integer NOT NULL DEFAULT 0,
  sent_count      integer NOT NULL DEFAULT 0,
  failed_count    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

-- one dispatch per (piece, exact edition). a re-preview of the same body returns
-- the same row; an edited body is a new hash = a new dispatch. this is what
-- blocks a double-blast of the SAME edition while allowing a corrected re-send.
CREATE UNIQUE INDEX IF NOT EXISTS np_newsletter_dispatch_piece_hash_uniq
  ON np_newsletter_dispatch (piece_id, body_hash);
-- the commit step looks the dispatch up by its server-minted token.
CREATE UNIQUE INDEX IF NOT EXISTS np_newsletter_dispatch_send_token_uniq
  ON np_newsletter_dispatch (send_token);
CREATE INDEX IF NOT EXISTS np_newsletter_dispatch_user_created_idx
  ON np_newsletter_dispatch (user_id, created_at DESC);

ALTER TABLE np_newsletter_dispatch ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_newsletter_dispatch_select_own ON np_newsletter_dispatch
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY np_newsletter_dispatch_insert_own ON np_newsletter_dispatch
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_newsletter_dispatch_update_own ON np_newsletter_dispatch
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY np_newsletter_dispatch_delete_own ON np_newsletter_dispatch
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER np_newsletter_dispatch_set_updated_at
  BEFORE UPDATE ON np_newsletter_dispatch
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMENT ON TABLE np_newsletter_dispatch IS
  'Nova Press newsletter blast, two-phase + resumable. UNIQUE(piece_id, body_hash) blocks a double-blast of one edition while allowing a corrected re-send (new hash). send_token gates the commit; per-recipient idempotency lives on np_email_log (dispatch_id, lower(to_email)). RLS owner-only.';
