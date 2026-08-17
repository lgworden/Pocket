-- Favourite fits: an explicit user-set flag on a logged outfit, ticked from the
-- "add to closet" modal's fit flow ("save this to my favs").
--
-- Before this, "shuffle favs" (lib/shuffleFavs.ts) inferred favourites purely
-- from repeat wears — a combo worn 3 times outranked one worn once. That still
-- holds; this flag is an additional, explicit signal that boosts a combo's
-- weight regardless of how often it's been logged.
ALTER TABLE outfit_logs ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;
