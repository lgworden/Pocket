-- A real geocodable home address, distinct from `location` (which is only a
-- coarse city string used for weather). Needed to estimate travel time home
-- and back between back-to-back calendar events (see lib/scheduleGaps.ts).
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_address TEXT;
