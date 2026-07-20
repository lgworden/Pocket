-- Profile photo, uploaded from the new /profile/[id] page (self only). Reuses
-- the same local-disk storage as item/outfit photos (see lib/photos.ts).
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
