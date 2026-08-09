-- Moments — a private, occasion-scoped outfit-coordination layer that lives on
-- the Today screen (app/stylist). A moment is an invitation-only plan tied to a
-- date/time; it expires 24h after the event ends and never posts to the public
-- feed. See the Moments spec + plan for the full product shape.
--
-- Three tables:
--   moments          — the event itself (creator-owned, soft-deletable)
--   moment_members   — membership + role + accept/decline status
--   moment_fit_inspo — reference images pinned to a moment (UI wired in Phase 2)
--
-- role/status use VARCHAR + CHECK rather than dedicated ENUMs: it keeps the set
-- editable without an ALTER TYPE dance and matches the lightweight style here.
--
-- Idempotent: Railway re-runs `npm run db:migrate` on every deploy, so every
-- statement is a no-op the second time through. Plain DDL only — the embedded
-- Postgres used for local verification has no plpgsql (no DO blocks).

CREATE TABLE IF NOT EXISTS moments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_name       VARCHAR(255) NOT NULL,
  description      TEXT,
  location         VARCHAR(255),
  google_maps_link VARCHAR(1024),
  vibe_words       TEXT[] NOT NULL DEFAULT '{}',
  formality_level  SMALLINT,                       -- 1 (sweatpants) .. 10 (black tie)
  event_date_time  TIMESTAMPTZ NOT NULL,
  event_end_time   TIMESTAMPTZ,                    -- defaults to start + 3h in app code when null
  expires_at       TIMESTAMPTZ NOT NULL,           -- (event_end_time or start+3h) + 24h; drives cleanup/filtering
  gcal_event_id    VARCHAR(512),                   -- linked Google Calendar event (Phase 3 write-back)
  gcal_written_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,                    -- soft delete
  CHECK (formality_level IS NULL OR (formality_level BETWEEN 1 AND 10))
);
CREATE INDEX IF NOT EXISTS idx_moments_creator ON moments(creator_id);
CREATE INDEX IF NOT EXISTS idx_moments_expires ON moments(expires_at);
CREATE INDEX IF NOT EXISTS idx_moments_deleted ON moments(deleted_at);

CREATE TABLE IF NOT EXISTS moment_members (
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
CREATE INDEX IF NOT EXISTS idx_moment_members_user ON moment_members(user_id);
CREATE INDEX IF NOT EXISTS idx_moment_members_status ON moment_members(status);
CREATE INDEX IF NOT EXISTS idx_moment_members_role ON moment_members(role);

CREATE TABLE IF NOT EXISTS moment_fit_inspo (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id      UUID NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  image_url      VARCHAR(1024) NOT NULL,
  uploaded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_moment_inspo_moment ON moment_fit_inspo(moment_id);

-- New notification types for moment invites/accepts/co-host/expiry. ADD VALUE
-- IF NOT EXISTS is a no-op once applied; none of these values are used within
-- this migration, so there's no in-transaction enum-usage hazard.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'moment_invite';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'moment_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'moment_cohost';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'moment_expiring';
