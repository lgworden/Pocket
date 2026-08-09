-- Phase 2 of Moments: let a feed post belong to a moment. A post with a
-- non-null moment_id is a member's outfit candidate for that moment — it is
-- shown inside the moment, never in the public feed (getFeedPosts filters on
-- moment_id IS NULL). ON DELETE SET NULL: if a moment is hard-deleted the
-- posts survive as ordinary (un-momented) posts rather than vanishing.
--
-- Reuses the existing feed_visibility enum — no new tier needed, the moment_id
-- filter alone keeps these out of the feed.
--
-- Idempotent plain DDL (embedded Postgres has no plpgsql / DO blocks).
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS moment_id UUID REFERENCES moments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_feed_posts_moment ON feed_posts(moment_id);
