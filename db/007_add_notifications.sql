-- In-app notification center: daily digest, weekly style analysis, weekly feed
-- summary, OOTD reminder. Delivery is in-app only for now (bell + /notifications);
-- schema leaves room for a future push layer without a rebuild (see memory).

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'daily_digest',
    'weekly_style_analysis',
    'weekly_feed_summary',
    'ootd_reminder'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  link       TEXT,             -- in-app path to deep-link to, e.g. "/?recId=..." or "/feed"
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
