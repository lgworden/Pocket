-- User feedback: a free-text note (plus an optional one-tap sentiment) sent
-- from /feedback. Every submission is stored here AND emailed to the operator
-- inbox (FEEDBACK_EMAIL_TO) — the row is the durable copy, so feedback is never
-- lost when the mail provider is unconfigured or erroring. `emailed_at` /
-- `email_error` record what happened on the mail side.
--
-- user_id is ON DELETE SET NULL (not CASCADE like the rest of the app): the
-- feedback is about the product, and outlives the account that sent it.
CREATE TABLE IF NOT EXISTS feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  sentiment   TEXT CHECK (sentiment IN ('love', 'meh', 'bug', 'idea')),
  source      TEXT,               -- where it came from, e.g. 'weekly_reminder', 'preferences'
  emailed_at  TIMESTAMPTZ,        -- set once the operator email is accepted by the provider
  email_error TEXT,               -- last send failure, if any (feedback still stored)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id, created_at DESC);

-- Weekly Monday-morning "how's it going?" nudge. ADD VALUE IF NOT EXISTS is a
-- no-op once applied (same pattern as 020/024/026); the value isn't used inside
-- this migration, so there's no in-transaction enum-usage hazard.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'feedback_request';
