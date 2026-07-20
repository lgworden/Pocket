-- Track whether the registration/onboarding flow (name, style, "how can we help") is done
ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
