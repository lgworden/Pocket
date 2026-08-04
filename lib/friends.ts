import crypto from "crypto";
import { headers } from "next/headers";
import pool from "./db";
import { createNotification } from "./notifications";

export type FriendTier = "friend" | "close_friend";

export type Friend = {
  id: string;
  name: string;
  username: string | null;
  tier: FriendTier;
};

// People the user is connected to, with the tier the user has assigned them.
export async function getFriends(userId: string): Promise<Friend[]> {
  const { rows } = await pool.query<Friend>(
    `SELECT f.friend_id AS id,
            COALESCE(u.display_name, u.name) AS name,
            u.username,
            f.tier
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = $1
      ORDER BY name`,
    [userId]
  );
  return rows;
}

// Tell `recipientId` that `actorId` just friended them. Best-effort: a failure
// here must never fail the friending itself. createNotification also fires the
// web push, so this covers both in-app and on-device delivery.
async function notifyNewFriend(recipientId: string, actorId: string): Promise<void> {
  try {
    const { rows } = await pool.query<{ name: string; username: string | null }>(
      "SELECT COALESCE(display_name, name) AS name, username FROM users WHERE id = $1",
      [actorId]
    );
    const actor = rows[0];
    const label = actor?.username ? `@${actor.username}` : actor?.name ?? "Someone";
    await createNotification(
      recipientId,
      "new_friend",
      "New friend",
      `${label} added you as a friend.`,
      `/profile/${actorId}`
    );
  } catch (err) {
    console.error("Failed to send new-friend notification:", err);
  }
}

// One reusable invite code per user — created on first request, reused after.
// Uncapped: growth matters more than scarcity right now (see
// SOCIAL_PIVOT_PLAN.md Phase 3 — a fixed cap shipped, then was explicitly
// reversed the same week). `invites.max_uses` still exists in the schema and
// invite_redemptions still tracks every acceptance, so reintroducing a cap
// later is just adding the check back in acceptInvite, not new plumbing.
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

export type InviteInfo = {
  inviterId: string;
  inviterName: string;
  inviterAvatar: string | null;
  joinedCount: number;
};

// Pre-auth preview for the invite landing page — no session required. Kept
// deliberately minimal: name/avatar/count only, nothing that would leak a
// private profile (no email, no friends list) to someone who hasn't joined.
export async function getInviteInfo(code: string): Promise<InviteInfo | null> {
  const { rows } = await pool.query<{
    id: string;
    inviter_user_id: string;
    inviter_name: string;
    inviter_avatar: string | null;
    joined: string;
  }>(
    `SELECT i.id, i.inviter_user_id,
            COALESCE(u.display_name, u.name) AS inviter_name,
            u.avatar AS inviter_avatar,
            (SELECT COUNT(*) FROM invite_redemptions WHERE invite_id = i.id) AS joined
       FROM invites i
       JOIN users u ON u.id = i.inviter_user_id
      WHERE i.code = $1`,
    [code]
  );
  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    inviterId: r.inviter_user_id,
    inviterName: r.inviter_name,
    inviterAvatar: r.inviter_avatar,
    joinedCount: Number(r.joined),
  };
}

// Same info, keyed by the inviter's own id — for their own share screen
// (app/preferences/page.tsx). Shown as a positive count ("N friends have
// joined"), not a remaining-capacity number — there's no cap.
export async function getInviteUsage(
  userId: string
): Promise<{ code: string; joinedCount: number }> {
  const code = await getOrCreateInviteCode(userId);
  const info = await getInviteInfo(code);
  return { code, joinedCount: info?.joinedCount ?? 0 };
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
// default 'friend' tier, and records a redemption for attribution/analytics —
// no capacity check, invites are uncapped (see getOrCreateInviteCode).
// Idempotent: re-accepting is a no-op and never double-records a redemption.
export async function acceptInvite(code: string, accepterId: string): Promise<AcceptResult> {
  const { rows } = await pool.query<{ id: string; inviter_user_id: string }>(
    "SELECT id, inviter_user_id FROM invites WHERE code = $1",
    [code]
  );
  if (rows.length === 0) return { status: "invalid" };

  const { id: inviteId, inviter_user_id: inviterId } = rows[0];
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
  await pool.query(
    `INSERT INTO invite_redemptions (invite_id, accepter_user_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [inviteId, accepterId]
  );

  if (already.rows.length > 0) return { status: "already_friends", inviterName };

  // New friendship via invite — the inviter finds out the same way they would
  // from a search-based add.
  await notifyNewFriend(inviterId, accepterId);
  return { status: "accepted", inviterName };
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

// Add a friend by user ID (used when searching by username). Notifies the other
// side — but only on a genuinely new friendship: RETURNING comes back empty when
// both directed rows already existed, so re-adding never re-notifies.
export async function addFriend(userId: string, friendId: string): Promise<void> {
  const { rows } = await pool.query(
    `INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1)
     ON CONFLICT (user_id, friend_id) DO NOTHING
     RETURNING user_id`,
    [userId, friendId]
  );
  if (rows.length === 0) return;

  await notifyNewFriend(friendId, userId);
}
