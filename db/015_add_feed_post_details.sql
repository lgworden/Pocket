-- Feed posts can now carry a location (free text, e.g. "Prospect Park") and tag
-- friends who appear in the photo. Friend tags are stored as an array of user
-- ids, consistent with how outfit_logs.item_ids references items; names are
-- resolved at read time by joining users.
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS location        TEXT,
  ADD COLUMN IF NOT EXISTS tagged_user_ids UUID[] NOT NULL DEFAULT '{}';
