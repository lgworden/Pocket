-- Track whether the new-user welcome carousel (closet/stylist/feed intro) has been seen
ALTER TABLE users
ADD COLUMN IF NOT EXISTS walkthrough_completed BOOLEAN NOT NULL DEFAULT false;
