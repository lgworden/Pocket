-- AI-generated "fashion sketchbook" croquis of an item, derived from its photo.
-- Nullable + on-demand: most items never have one, and generation never blocks
-- the add-item flow (product principle: never nag for optional data).
ALTER TABLE items ADD COLUMN IF NOT EXISTS sketch TEXT;
