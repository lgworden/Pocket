-- Notification for "someone added you as a friend". Friending is symmetric
-- (lib/friends.ts writes both directed rows), so only the person who *didn't*
-- initiate gets notified — see notifyNewFriend.
--
-- Idempotent: Railway re-runs `npm run db:migrate` on every deploy, and
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS is a no-op once applied (same pattern
-- as 020_add_social.sql).
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_friend';
