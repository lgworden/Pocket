-- "How often do you want to hear from us?" answers from onboarding
-- { sync_gcal, friends_updates, daily_digest } booleans
ALTER TABLE users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';
