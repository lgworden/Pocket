-- Asymmetric follow graph + influencer signal + new visibility/notification
-- values, for the social-first pivot (see SOCIAL_PIVOT_PLAN.md).
--
-- This is a NEW table, deliberately kept separate from `friendships`.
-- `friendships` stays exactly as it is today: a mutual, tiered GRANT — its
-- `tier` column is "how the row's OWNER (user_id) categorizes friend_id,
-- gating which of the OWNER's own posts friend_id may see" (see
-- 010_add_friends.sql). That is a different relationship from "follow," and
-- reusing it very nearly shipped a real access-control bug during planning:
-- different existing call sites check different directions of that table
-- (lib/profile.ts checks the viewer's row; lib/feedQueries.ts checks the
-- author's row), which was harmless only because every existing insert is
-- paired (both directions written together), so the two directions were
-- always equivalent. A genuinely one-directional row would have made those
-- call sites diverge silently. `follows` has one unambiguous meaning: a row
-- means exactly "follower_id follows followee_id" — nothing else reads or
-- writes it with any other interpretation.
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows(followee_id); -- follower counts / threshold check
CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows(follower_id); -- following counts

-- NULL = not an influencer. Set once, the first time a user's follower count
-- crosses the threshold, and left set thereafter — a stored fact rather than
-- a live computation, so the badge doesn't flicker off if a follower count
-- dips afterward. See lib/follows.ts for the threshold check.
ALTER TABLE users ADD COLUMN IF NOT EXISTS influencer_since TIMESTAMPTZ;

-- Fourth visibility tier: opt-in per post, visible to anyone who follows the
-- author (see lib/feedQueries.ts). Existing posts are never touched by this
-- migration — every post authored before this ships keeps the tier its
-- author chose under the friends-only app.
ALTER TYPE feed_visibility ADD VALUE IF NOT EXISTS 'public';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_follower';
