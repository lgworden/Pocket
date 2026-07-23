-- Add username field for friend discovery.
-- Idempotent: Railway re-runs `npm run db:migrate` as a pre-deploy step on every
-- deploy, so each statement must be safe to run against a database that already
-- has this migration applied (matching the ADD COLUMN IF NOT EXISTS pattern used
-- by every other migration here).
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

-- Postgres names an inline column UNIQUE constraint deterministically as
-- <table>_<column>_key, so guard on that name to avoid re-adding it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
