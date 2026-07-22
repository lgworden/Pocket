-- Add username field for friend discovery
ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
CREATE INDEX idx_users_username ON users(username);
