-- Public-facing profile: a short bio shown on the new /profile/[id] page
-- (viewable by the user themself or any accepted friend). No avatar upload
-- yet — the profile page renders initials instead.
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
