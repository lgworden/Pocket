-- Follow becomes a designer-only affordance.
--
-- `influencer_since` (020_add_social.sql) used to be *earned*: lib/follows.ts
-- stamped it the first time a user's follower count crossed a threshold, and
-- the profile page rendered an "influencer" chip. That's now inverted — the
-- status is granted out-of-band by an operator (scripts/designer.mjs), is the
-- sole thing that makes an account followable, and is deliberately invisible
-- in the UI: no label, no progress hint, no way for a user to learn it exists
-- or how to get it.
--
-- Replacing the column rather than renaming it does two useful things: it
-- makes the old threshold semantics unreachable, and it discards any value
-- auto-awarded under the old rule, so the only designers are ones an operator
-- granted on purpose. (020 still re-runs its `ADD COLUMN IF NOT EXISTS
-- influencer_since` on every deploy — it's left untouched as applied history,
-- and this drop right after is a cheap no-op on an empty column.)
--
-- Idempotent: Railway re-runs `npm run db:migrate` on every deploy, so every
-- statement here is a no-op the second time through. Kept to plain DDL — no
-- DO/plpgsql block, since the embedded Postgres used for local verification
-- has no plpgsql.
ALTER TABLE users ADD COLUMN IF NOT EXISTS designer_since TIMESTAMPTZ;
ALTER TABLE users DROP COLUMN IF EXISTS influencer_since;

-- Seed grant for the app owner's Google-provisioned account. Username/password
-- accounts have a NULL email, so a handle-based grant goes through
-- `npm run designer:grant -- <username>` instead.
UPDATE users
   SET designer_since = now()
 WHERE email = 'lilygworden@gmail.com'
   AND designer_since IS NULL;
