-- Closet Stylist — schema (Phase 1 tables first; recs/badges/vision_boards included
-- now so migrations don't need to be revisited later, per "multiplayer bones" principle)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE,        -- only set for Google-provisioned accounts
  password_hash TEXT,               -- scrypt digest for username/password accounts (lib/password.ts)
  display_name  TEXT,               -- custom name for app to use; falls back to name
  location      TEXT,              -- e.g. "Washington, DC" — for weather lookups
  home_address  TEXT,              -- real geocodable address — for travel-time-to-change checks
  style_profile JSONB DEFAULT '{}',
  scheduling_preferences JSONB DEFAULT '{}', -- { office_days: ['mon', 'wed', 'fri'], ... }
  google_calendar JSONB,            -- { access_token, refresh_token, expiry_date } once connected
  onboarding_completed BOOLEAN NOT NULL DEFAULT false, -- gates access until registration flow is done
  walkthrough_completed BOOLEAN NOT NULL DEFAULT false, -- gates access until the welcome carousel is seen/skipped
  notification_preferences JSONB DEFAULT '{}', -- { sync_gcal, friends_updates, daily_digest } from onboarding
  designer_since TIMESTAMPTZ, -- granted out-of-band by an operator (scripts/designer.mjs); the only accounts that can be followed. Never surfaced in the UI — see lib/designers.ts
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE item_category AS ENUM ('top','bottom','dress','outerwear','shoes','bag','accessory');
CREATE TYPE item_provenance AS ENUM ('thrifted','retail','gifted','secondhand','handmade');
CREATE TYPE item_status AS ENUM ('active','archived','donated');

CREATE TABLE items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id    TEXT UNIQUE NOT NULL,   -- human-readable: TOP-0042, SHOE-0007
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  brand         TEXT,
  category      item_category NOT NULL,
  subcategory   TEXT,
  occasions     TEXT[] DEFAULT '{}',    -- workwear, casual, going-out, athletic, lounge
  tags          TEXT[] DEFAULT '{}',    -- free-form vibe words
  colors        TEXT[] DEFAULT '{}',    -- primary + secondary
  warmth        SMALLINT CHECK (warmth BETWEEN 1 AND 5),
  formality     SMALLINT CHECK (formality BETWEEN 1 AND 5),
  seasons       TEXT[] DEFAULT '{}',
  provenance    item_provenance,
  cost          NUMERIC(10,2),          -- optional; powers cost-per-wear
  status        item_status DEFAULT 'active',
  photos        TEXT[] DEFAULT '{}',
  date_added    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_items_user ON items(user_id);
CREATE INDEX idx_items_category ON items(category);

CREATE TYPE log_source AS ENUM ('recommended','self_styled');
CREATE TYPE log_visibility AS ENUM ('private','shared');

CREATE TABLE outfit_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  item_ids          UUID[] NOT NULL,
  photo             TEXT,
  occasion          TEXT,
  weather_snapshot  JSONB,
  source            log_source DEFAULT 'self_styled',
  visibility        log_visibility DEFAULT 'private',
  notes             TEXT,
  is_favorite       BOOLEAN NOT NULL DEFAULT FALSE,  -- user-flagged favourite, boosts shuffle favs (see 029)
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_logs_user_date ON outfit_logs(user_id, date);

CREATE TYPE rec_outcome AS ENUM ('worn','skipped','modified');

CREATE TABLE recommendations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  context     JSONB,     -- weather + day summary + mood
  options     JSONB,     -- the 2-3 outfits proposed with reasoning
  outcome     rec_outcome,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_recs_user_date ON recommendations(user_id, date);

CREATE TABLE badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type  TEXT NOT NULL,
  earned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  context     JSONB
);
CREATE INDEX idx_badges_user ON badges(user_id);

CREATE TABLE vision_boards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season          TEXT,
  year            SMALLINT,
  images          TEXT[] DEFAULT '{}',
  style_direction TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Feed: shareable outfit posts + limited emoji reactions (see 006_add_feed.sql).
-- Four visibility tiers: "public" (anyone who follows the author — see
-- 020_add_social.sql), broad "friends", inner "close_friends", or "private"
-- (a personal "safe for later" save that still renders in the owner's collage).
CREATE TYPE feed_visibility AS ENUM ('public', 'friends', 'close_friends', 'private');
CREATE TYPE feed_reaction AS ENUM ('cheers', 'fire', 'eyes');

CREATE TABLE feed_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo           TEXT NOT NULL,
  caption         TEXT,
  visibility      feed_visibility NOT NULL DEFAULT 'friends',
  outfit_log_id   UUID REFERENCES outfit_logs(id) ON DELETE SET NULL,
  location        TEXT,                            -- free-text place the photo was taken
  tagged_user_ids UUID[] NOT NULL DEFAULT '{}',    -- friends tagged in the photo (see 015)
  moment_id       UUID,                            -- if set, a moment outfit candidate — kept out of the feed (see 027)
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_feed_posts_user ON feed_posts(user_id);
CREATE INDEX idx_feed_posts_created ON feed_posts(created_at DESC);

CREATE TABLE feed_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction   feed_reaction NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, user_id, reaction)
);
CREATE INDEX idx_feed_reactions_post ON feed_reactions(post_id);

-- Comments on feed posts, shown on the flipped card's back face (see 017_add_feed_comments.sql).
CREATE TABLE feed_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_feed_comments_post ON feed_comments(post_id, created_at);

-- In-app notification center (see 007_add_notifications.sql).
CREATE TYPE notification_type AS ENUM (
  'daily_digest',
  'weekly_style_analysis',
  'weekly_feed_summary',
  'ootd_reminder',
  'new_follower',
  'new_friend',
  'moment_invite',
  'moment_accepted',
  'moment_cohost',
  'moment_expiring',
  'feedback_request'
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  link       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

-- Friend graph + invite links (see 010_add_friends.sql).
CREATE TYPE friend_tier AS ENUM ('friend', 'close_friend');

CREATE TABLE friendships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier       friend_tier NOT NULL DEFAULT 'friend',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
CREATE INDEX friendships_user_idx ON friendships(user_id);
CREATE INDEX friendships_friend_idx ON friendships(friend_id);

-- Asymmetric follow graph (see 020_add_social.sql) — deliberately separate
-- from `friendships` above. A row here means exactly one thing: follower_id
-- follows followee_id. `friendships` stays the mutual, tiered grant that
-- gates 'friends'/'close_friends' post visibility; `follows` gates the
-- 'public' tier and drives follower counts. Only designers (see
-- users.designer_since) can be followed at all — enforced in lib/follows.ts,
-- not by a constraint here, since the grant can be revoked without wanting to
-- destroy the existing rows.
CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee_idx ON follows(followee_id);
CREATE INDEX follows_follower_idx ON follows(follower_id);

-- Invites are uncapped — growth matters more than scarcity right now (see
-- SOCIAL_PIVOT_PLAN.md Phase 3). `max_uses` shipped, was enforced briefly,
-- then explicitly reversed the same week; left in the schema, unused by
-- lib/friends.ts, so a future cap is just re-adding the check, not new
-- plumbing or a migration.
CREATE TABLE invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_uses        INT NOT NULL DEFAULT 5,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX invites_inviter_idx ON invites(inviter_user_id);

-- Every acceptance, tracked for attribution/analytics — not for capacity
-- enforcement (see above). Still useful: shows "N joined via your link" and
-- (idempotently) never double-records a re-accept.
CREATE TABLE invite_redemptions (
  invite_id        UUID NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  accepter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (invite_id, accepter_user_id)
);
CREATE INDEX invite_redemptions_invite_idx ON invite_redemptions(invite_id);

-- Lightweight product-analytics event log (DIY tracking for the friends beta).
CREATE TABLE events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_type_created ON events(event_type, created_at);
CREATE INDEX idx_events_user_created ON events(user_id, created_at);

-- Moments — private, occasion-scoped outfit-coordination plans on the Today
-- screen (app/stylist). Invitation-only, expire 24h after the event ends, never
-- posted to the feed. See 026_add_moments.sql. role/status are CHECK-constrained
-- VARCHARs (not ENUMs) to keep the sets editable without an ALTER TYPE dance.
CREATE TABLE moments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_name       VARCHAR(255) NOT NULL,
  description      TEXT,
  location         VARCHAR(255),
  google_maps_link VARCHAR(1024),
  vibe_words       TEXT[] NOT NULL DEFAULT '{}',
  formality_level  SMALLINT,
  event_date_time  TIMESTAMPTZ NOT NULL,
  event_end_time   TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL,
  gcal_event_id    VARCHAR(512),
  gcal_written_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CHECK (formality_level IS NULL OR (formality_level BETWEEN 1 AND 10))
);
CREATE INDEX idx_moments_creator ON moments(creator_id);
CREATE INDEX idx_moments_expires ON moments(expires_at);
CREATE INDEX idx_moments_deleted ON moments(deleted_at);

CREATE TABLE moment_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id   UUID NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('creator', 'collaborator', 'invitee')),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (moment_id, user_id)
);
CREATE INDEX idx_moment_members_user ON moment_members(user_id);
CREATE INDEX idx_moment_members_status ON moment_members(status);
CREATE INDEX idx_moment_members_role ON moment_members(role);

CREATE TABLE moment_fit_inspo (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id      UUID NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  image_url      VARCHAR(1024) NOT NULL,
  uploaded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_moment_inspo_moment ON moment_fit_inspo(moment_id);

-- feed_posts.moment_id FK — declared here, after `moments` exists (the column
-- itself is on feed_posts above). A moment-linked post is a member's outfit
-- candidate, kept out of the feed; ON DELETE SET NULL keeps posts if a moment
-- is hard-deleted. See 027_add_moment_posts.sql.
ALTER TABLE feed_posts
  ADD CONSTRAINT feed_posts_moment_id_fkey
  FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE SET NULL;
CREATE INDEX idx_feed_posts_moment ON feed_posts(moment_id);

-- User feedback (see 028_add_feedback.sql). Stored durably here and emailed to
-- the operator inbox; user_id is SET NULL on delete so the note outlives the
-- account that sent it.
CREATE TABLE feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  sentiment   TEXT CHECK (sentiment IN ('love', 'meh', 'bug', 'idea')),
  source      TEXT,
  emailed_at  TIMESTAMPTZ,
  email_error TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX idx_feedback_user ON feedback(user_id, created_at DESC);

-- Wear count / last-worn are derived views, never stored redundantly (per build plan)
CREATE VIEW item_wear_stats AS
SELECT
  i.id AS item_id,
  i.user_id,
  COUNT(l.id) AS wear_count,
  MAX(l.date) AS last_worn
FROM items i
LEFT JOIN outfit_logs l ON i.id = ANY(l.item_ids)
GROUP BY i.id, i.user_id;
