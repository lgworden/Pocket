-- Countable invites (see SOCIAL_PIVOT_PLAN.md Phase 3). Each invite link now
-- has a fixed capacity instead of being an unlimited reusable code — scarcity
-- makes an invite-only app feel worth having, per the plan.
--
-- Redemptions are tracked in their own table rather than a mutable counter on
-- `invites`, so re-accepting an already-redeemed invite (the existing
-- idempotent "already_friends" path in acceptInvite) never double-consumes a
-- slot, and there's an audit trail of who came from which invite.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS max_uses INT NOT NULL DEFAULT 5;

CREATE TABLE IF NOT EXISTS invite_redemptions (
  invite_id        UUID NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  accepter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (invite_id, accepter_user_id)
);
CREATE INDEX IF NOT EXISTS invite_redemptions_invite_idx ON invite_redemptions(invite_id);
