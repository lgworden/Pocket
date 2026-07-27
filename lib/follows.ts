import pool from "./db";
import { createNotification } from "./notifications";

// Asymmetric follow graph. Deliberately a separate table/module from
// lib/friends.ts — see 020_add_social.sql for why reusing `friendships`
// would have been a correctness trap. A `follows` row means exactly one
// thing: follower_id follows followee_id.

// Automatic "influencer" status kicks in at this many followers. Placeholder
// pending real distribution data (see SOCIAL_PIVOT_PLAN.md "Open decisions")
// — tune here once there's signal on what's actually rare.
const INFLUENCER_THRESHOLD = 50;

export async function follow(followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) return;

  const { rows } = await pool.query(
    `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING followee_id`,
    [followerId, followeeId]
  );
  if (rows.length === 0) return; // already following — no-op, no duplicate notification

  await maybePromoteToInfluencer(followeeId);

  const { rows: nameRows } = await pool.query<{ name: string }>(
    "SELECT COALESCE(display_name, name) AS name FROM users WHERE id = $1",
    [followerId]
  );
  await createNotification(
    followeeId,
    "new_follower",
    "New follower",
    `${nameRows[0]?.name ?? "Someone"} started following you.`,
    `/profile/${followerId}`
  );
}

export async function unfollow(followerId: string, followeeId: string): Promise<void> {
  await pool.query(
    "DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2",
    [followerId, followeeId]
  );
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2",
    [followerId, followeeId]
  );
  return rows.length > 0;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM follows WHERE followee_id = $1",
    [userId]
  );
  return Number(rows[0].count);
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM follows WHERE follower_id = $1",
    [userId]
  );
  return Number(rows[0].count);
}

// Sets `influencer_since` the first time (and only the first time) a user's
// follower count crosses the threshold — a stored fact, not a live
// computation, so the badge doesn't flicker off if a follower count dips
// later. Run inline after each new follow, same pattern as the build plan's
// badge queries (checked after each relevant action, not as a background job).
async function maybePromoteToInfluencer(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users SET influencer_since = now()
     WHERE id = $1
       AND influencer_since IS NULL
       AND (SELECT COUNT(*) FROM follows WHERE followee_id = $1) >= $2`,
    [userId, INFLUENCER_THRESHOLD]
  );
}
