-- Add user preference analysis tables for personalized learning
-- Run after: npm run db:migrate (which applies schema.sql)

CREATE TABLE IF NOT EXISTS user_preference_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Implicit preference summaries (refreshed after each outfit log)
  top_worn_items JSONB DEFAULT '[]'::jsonb,           -- Most frequently worn item IDs + wear counts
  top_worn_colors TEXT[] DEFAULT '{}',                -- Colors most frequently in worn outfits
  top_worn_occasions TEXT[] DEFAULT '{}',             -- Most common occasions
  top_worn_categories TEXT[] DEFAULT '{}',            -- Item categories in worn outfits

  -- Rejection patterns (what does user skip?)
  frequently_skipped_colors TEXT[] DEFAULT '{}',
  frequently_skipped_formality INT[] DEFAULT '{}',

  -- Contextual patterns
  weekday_preferences JSONB DEFAULT '{}'::jsonb,      -- Day-of-week patterns
  temperature_preferences JSONB DEFAULT '{}'::jsonb,  -- Temperature-based preferences

  -- Evolution tracking
  preference_evolution_history JSONB[] DEFAULT '{}',  -- Time-series snapshots
  last_updated TIMESTAMPTZ DEFAULT now(),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_preference_analysis ON user_preference_analysis(user_id);

-- Helper table for item-outcome tracking
CREATE TABLE IF NOT EXISTS item_outcome_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,

  worn_count INT DEFAULT 0,
  skipped_count INT DEFAULT 0,          -- Times item was in recommendation and skipped
  recommended_count INT DEFAULT 0,      -- Total times recommended

  accept_rate DECIMAL(5,4),             -- worn_count / recommended_count
  last_outcome TEXT,
  last_interaction_date DATE,

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_item_outcome_tracking ON item_outcome_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_item_outcome_by_item ON item_outcome_tracking(item_id);

-- Initialize user_preference_analysis for existing users
INSERT INTO user_preference_analysis (user_id)
SELECT DISTINCT id FROM users
ON CONFLICT DO NOTHING;
