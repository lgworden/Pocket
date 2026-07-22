import crypto from "crypto";
import { headers } from "next/headers";
import pool from "./db";

export type FriendTier = "friend" | "close_friend";

export type Friend = {
  id: string;
  name: string;
  tier: FriendTier;
};

// People the user is connected to, with the tier the user has assigned them.
export async function getFriends(userId: string): Promise<Friend[]> {
  const { rows } = await pool.query<Friend>(
    `SELECT f.friend_id AS id,
            COALESCE(u.display_name, u.name) AS name,
            f.tier
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = $1
      ORDER BY name`,
    [userId]
  );
  return rows;
}

// One reusable invite code per user — created on first request, reused after.
export async function getOrCreateInviteCode(userId: string): Promise<string> {
  const existing = await pool.query<{ code: string }>(
    "SELECT code FROM invites WHERE inviter_user_id = $1 ORDER BY created_at LIMIT 1",
    [userId]
  );
  if (existing.rows.length > 0) return existing.rows[0].code;

  const code = crypto.randomBytes(9).toString("base64url"); // 12-char url-safe
  const { rows } = await pool.query<{ code: string }>(
    "INSERT INTO invites (code, inviter_user_id) VALUES ($1, $2) RETURNING code",
    [code, userId]
  );
  return rows[0].code;
}

// Build an absolute invite URL from the request host so the copied link works
// on whatever origin the app is actually served from (localhost or Railway).
export function inviteUrlFor(code: string): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}/invite/${code}`;
}

export type AcceptResult =
  | { status: "accepted"; inviterName: string }
  | { status: "already_friends"; inviterName: string }
  | { status: "self" }
  | { status: "invalid" };

// Accepting an invite creates the mutual friendship (both directed rows) at the
// default 'friend' tier. Idempotent: re-accepting is a no-op.
export async function acceptInvite(code: string, accepterId: string): Promise<AcceptResult> {
  const { rows } = await pool.query<{ inviter_user_id: string }>(
    "SELECT inviter_user_id FROM invites WHERE code = $1",
    [code]
  );
  if (rows.length === 0) return { status: "invalid" };

  const inviterId = rows[0].inviter_user_id;
  const nameRes = await pool.query<{ name: string }>(
    "SELECT COALESCE(display_name, name) AS name FROM users WHERE id = $1",
    [inviterId]
  );
  const inviterName = nameRes.rows[0]?.name ?? "your friend";

  if (inviterId === accepterId) return { status: "self" };

  const already = await pool.query(
    "SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2",
    [accepterId, inviterId]
  );

  await pool.query(
    `INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1)
     ON CONFLICT (user_id, friend_id) DO NOTHING`,
    [accepterId, inviterId]
  );

  return already.rows.length > 0
    ? { status: "already_friends", inviterName }
    : { status: "accepted", inviterName };
}

// Update how `userId` categorizes `friendId` (gates which of userId's posts
// friendId sees). Only affects the caller's own directed row.
export async function setFriendTier(
  userId: string,
  friendId: string,
  tier: FriendTier
): Promise<void> {
  await pool.query(
    "UPDATE friendships SET tier = $3 WHERE user_id = $1 AND friend_id = $2",
    [userId, friendId, tier]
  );
}

// Unfriending is mutual: removes both directed rows so neither side keeps
// visibility into the other's friends-tier posts.
export async function removeFriend(userId: string, friendId: string): Promise<void> {
  await pool.query(
    `DELETE FROM friendships
      WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [userId, friendId]
  );
}

// Add a friend by user ID (used when searching by username)
export async function addFriend(userId: string, friendId: string): Promise<void> {
  await pool.query(
    `INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1)
     ON CONFLICT (user_id, friend_id) DO NOTHING`,
    [userId, friendId]
  );
}
