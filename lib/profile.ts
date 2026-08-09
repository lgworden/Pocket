import pool from "./db";
import { getFollowerCount, isFollowing } from "./follows";

export type ProfileUser = {
  id: string;
  name: string;
  display_name: string | null;
  bio: string | null;
  avatar: string | null;
  location: string | null;
  created_at: string;
  // Non-null = a designer: followable, and rendered with the warmer profile
  // header. Never labelled as such in the UI — see lib/designers.ts.
  designer_since: string | null;
};

export type ProfileStats = {
  item_count: number;
  outfit_count: number;
  friend_count: number;
  // Only rendered on designer profiles — they're the only accounts that can be
  // followed, so for everyone else this is structurally always 0.
  follower_count: number;
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
    `SELECT id, name, display_name, bio, avatar, location, created_at, designer_since
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
    "SELECT DISTINCT date FROM outfit_logs WHERE user_id = $1 ORDER BY date DESC LIMIT 100",
    [userId]
  );
  if (rows.length === 0) return 0;

  // Work with dates as strings (YYYY-MM-DD) to avoid timezone confusion.
  // Compare consecutive dates to see if they're exactly 1 day apart.
  const dateStrings = rows.map(r => {
    if (typeof r.date === 'string') return r.date;
    if (r.date instanceof Date) return r.date.toISOString().split('T')[0];
    return (r.date as any).toString().split(' ')[0];
  });

  const today = new Date().toISOString().split('T')[0];
  const mostRecent = dateStrings[0];

  // Streak is broken if the most recent log is older than yesterday
  const isToday = mostRecent === today;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const isYesterday = mostRecent === yesterday;

  if (!isToday && !isYesterday) return 0;

  let streak = 1;
  for (let i = 1; i < dateStrings.length; i++) {
    const curr = dateStrings[i - 1];
    const prev = dateStrings[i];
    const currDate = new Date(curr);
    const prevDate = new Date(prev);
    const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));

    if (daysDiff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [{ rows }, streak_days, follower_count] = await Promise.all([
    pool.query<{ item_count: string; outfit_count: string; friend_count: string }>(
      `SELECT
         (SELECT COUNT(*) FROM items WHERE user_id = $1 AND status != 'archived') AS item_count,
         (SELECT COUNT(*) FROM feed_posts WHERE user_id = $1 AND visibility IN ('friends', 'close_friends')) AS outfit_count,
         (SELECT COUNT(*) FROM friendships WHERE user_id = $1) AS friend_count`,
      [userId]
    ),
    getOOTDStreak(userId),
    getFollowerCount(userId),
  ]);
  return {
    item_count: Number(rows[0]?.item_count ?? 0),
    outfit_count: Number(rows[0]?.outfit_count ?? 0),
    friend_count: Number(rows[0]?.friend_count ?? 0),
    follower_count,
    streak_days,
  };
}
