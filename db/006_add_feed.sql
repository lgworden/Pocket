-- Feed: shareable outfit posts + limited emoji reactions (Phase 5 "friends feed",
-- pulled forward). Visibility has three tiers so a post can be scoped to the
-- broad friends circle, an inner "close friends" circle, or kept private
-- ("safe for later" — a personal save that still lives in the collage).

DO $$ BEGIN
  CREATE TYPE feed_visibility AS ENUM ('friends', 'close_friends', 'private');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE feed_reaction AS ENUM ('cheers', 'fire', 'eyes');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS feed_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo        TEXT NOT NULL,
  caption      TEXT,
  visibility   feed_visibility NOT NULL DEFAULT 'friends',
  outfit_log_id UUID REFERENCES outfit_logs(id) ON DELETE SET NULL, -- optional link to a logged wear
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feed_posts_user ON feed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created ON feed_posts(created_at DESC);

-- One row per (post, reactor, reaction). Unique so a friend can't stack the same
-- emoji; a friend may leave more than one distinct reaction on a post.
CREATE TABLE IF NOT EXISTS feed_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction   feed_reaction NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, user_id, reaction)
);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_post ON feed_reactions(post_id);
