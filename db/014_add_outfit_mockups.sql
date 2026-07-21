-- Cache for AI-composed outfit mockups. One image per distinct SET of pieces
-- (item_key = the outfit's display_ids, sorted + joined), so the same combination
-- — including every shuffle-favs replay of a previously-worn look — is generated
-- once and then reused for free. Keyed per user because display_id sequences are
-- per user. Orphaned rows (an item later removed from the closet) are harmless:
-- the row is just an image URL, never joined back to items.
CREATE TABLE IF NOT EXISTS outfit_mockups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key   TEXT NOT NULL,
  mockup_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);
