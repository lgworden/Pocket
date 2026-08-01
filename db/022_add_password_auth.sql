-- Username + password registration, so signing up no longer requires a Google
-- account (Google Sign-In stays available as a second option).
--
-- email becomes optional: accounts created with a username have no email at
-- all. Postgres treats NULLs as distinct in a UNIQUE constraint, so the
-- existing users_email_key still holds for the accounts that do have one.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- scrypt hash, stored as "scrypt$<salt-hex>$<derived-key-hex>" — see lib/password.ts.
-- NULL for accounts provisioned through Google, which never set one.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Usernames are matched case-insensitively at sign-in, so uniqueness has to be
-- case-insensitive too — otherwise "Nora" and "nora" become two accounts that
-- one login can't tell apart. The plain UNIQUE (username) from 016 stays as-is.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username));
