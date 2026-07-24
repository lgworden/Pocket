-- Lightweight product-analytics event log (DIY tracking for the friends beta).
CREATE TABLE IF NOT EXISTS events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Feature-usage counts / time-series group by type first, then filter by date.
CREATE INDEX IF NOT EXISTS idx_events_type_created ON events(event_type, created_at);
-- DAU/WAU/retention scan per-user activity by date.
CREATE INDEX IF NOT EXISTS idx_events_user_created ON events(user_id, created_at);
