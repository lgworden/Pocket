-- Add preferences fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS scheduling_preferences JSONB DEFAULT '{}';
