import pool from "./db";
import { createNotification } from "./notifications";
import { isDesigner } from "./designers";

// Asymmetric follow graph. Deliberately a separate table/module from
// lib/friends.ts — see 020_add_social.sql for why reusing `friendships`
// would have been a correctness trap. A `follows` row means exactly one
// thing: follower_id follows followee_id.
//
// Following is designer-only (see lib/designers.ts). Everyone else connects
// through the mutual friend graph instead.

// Returns false if the target isn't followable — the caller decides whether
// that's worth surfacing. This is the real gate: the profile page hides the
// follow button for non-designers, but that's cosmetic, and a hand-rolled
// POST to /api/follows/:id has to fail here regardless.
export async function follow(followerId: string, followeeId: string): Promise<boolean> {
  if (followerId === followeeId) return false;
  if (!(await isDesigner(followeeId))) return false;

  const { rows } = await pool.query(
    `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING followee_id`,
    [followerId, followeeId]
  );
  if (rows.length === 0) return true; // already following — no duplicate notification

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
  return true;
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

