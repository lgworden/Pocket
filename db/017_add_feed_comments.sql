-- Comments on feed posts, shown on the flipped card's back face next to the
-- emoji reactions on the front. Plain text only, no threading/replies.
CREATE TABLE IF NOT EXISTS feed_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post ON feed_comments(post_id, created_at);
