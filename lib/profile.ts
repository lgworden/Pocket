import pool from "./db";
import { getFollowerCount, getFollowingCount, isFollowing } from "./follows";

export type ProfileUser = {
  id: string;
  name: string;
  display_name: string | null;
  bio: string | null;
  avatar: string | null;
  location: string | null;
  created_at: string;
  influencer_since: string | null;
};

export type ProfileStats = {
  item_count: number;
  outfit_count: number;
  friend_count: number;
  follower_count: number;
  following_count: number;
  streak_days: number;
};

// The access ladder: every profile is reachable (name, avatar, counts, follow
// button), but posts and the friends list widen only as the relationship
// deepens. "friend" here means mutual — a `friendships` row exists (that
// table is unchanged from before follows existed; see lib/friends.ts).
// "follower" means a one-way `follows` row — enough to see the author's
// `public`-tier posts (lib/feedQueries.ts enforces this at the query level
// regardless of what this function returns; this is for UI copy/gating only).
export type ProfileAccess = "self" | "friend" | "follower" | "stranger";

export async function getProfileAccess(
  viewerId: string,
  profileUserId: string
): Promise<ProfileAccess> {
  if (viewerId === profileUserId) return "self";

  const { rows } = await pool.query<{ is_friend: boolean }>(
    "SELECT 1 AS is_friend FROM friendships WHERE user_id = $1 AND friend_id = $2",
    [viewerId, profileUserId]
  );
  if (rows.length > 0) return "friend";

  if (await isFollowing(viewerId, profileUserId)) return "follower";

  return "stranger";
}

export async function getProfileUser(userId: string): Promise<ProfileUser | null> {
  const { rows } = await pool.query<ProfileUser>(
    `SELECT id, name, display_name, bio, avatar, location, created_at, influencer_since
       FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

// Current "outfit of the day" streak: consecutive calendar days (ending today
// or yesterday — a day that hasn't happened yet doesn't break it) with at
// least one outfit_logs row. Any gap, or a most-recent log older than
// yesterday, resets the streak to 0.
async function getOOTDStreak(userId: string): Promise<number> {
  const { rows } = await pool.query<{ date: string }>(
    "SELECT DISTINCT date::text AS date FROM outfit_logs WHERE user_id = $1 ORDER BY date DESC",
    [userId]
  );
  if (rows.length === 0) return 0;

  const oneDay = 24 * 60 * 60 * 1000;
  const dayMs = (s: string) => Date.parse(`${s}T00:00:00Z`);
  const today = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  );

  const mostRecent = dayMs(rows[0].date);
  if (today - mostRecent > oneDay) return 0;

  let streak = 1;
  for (let i = 1; i < rows.length; i++) {
    const gap = dayMs(rows[i - 1].date) - dayMs(rows[i].date);
    if (gap === oneDay) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [{ rows }, streak_days, follower_count, following_count] = await Promise.all([
    pool.query<{ item_count: string; outfit_count: string; friend_count: string }>(
      `SELECT
         (SELECT COUNT(*) FROM items WHERE user_id = $1 AND status != 'archived') AS item_count,
         (SELECT COUNT(*) FROM feed_posts WHERE user_id = $1 AND visibility IN ('friends', 'close_friends')) AS outfit_count,
         (SELECT COUNT(*) FROM friendships WHERE user_id = $1) AS friend_count`,
      [userId]
    ),
    getOOTDStreak(userId),
    getFollowerCount(userId),
    getFollowingCount(userId),
  ]);
  return {
    item_count: Number(rows[0]?.item_count ?? 0),
    outfit_count: Number(rows[0]?.outfit_count ?? 0),
    friend_count: Number(rows[0]?.friend_count ?? 0),
    follower_count,
    following_count,
    streak_days,
  };
}
