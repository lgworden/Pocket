-- Friend graph + invite links for the multi-user social feed (Phase 5).

DO $$ BEGIN
  CREATE TYPE friend_tier AS ENUM ('friend', 'close_friend');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Directed friendship rows. A connection between A and B is two rows (A->B and
-- B->A), both created when an invite is accepted. `tier` is per-direction: it is
-- how the row's OWNER (user_id) categorizes friend_id, and it gates which of the
-- owner's posts friend_id is allowed to see (a 'close_friends' post is visible
-- only to friends the owner has marked close_friend).
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier friend_tier NOT NULL DEFAULT 'friend',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
CREATE INDEX IF NOT EXISTS friendships_user_idx ON friendships(user_id);
CREATE INDEX IF NOT EXISTS friendships_friend_idx ON friendships(friend_id);

-- Reusable invite links: one code can be shared with several friends; each
-- acceptance creates the two friendship rows. Acceptance is recorded by the
-- friendship rows themselves, so no per-invite acceptance bookkeeping here.
CREATE TABLE IF NOT EXISTS invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  inviter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invites_inviter_idx ON invites(inviter_user_id);
