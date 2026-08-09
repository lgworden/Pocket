import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { isDesigner } from "@/lib/designers";
import pool from "@/lib/db";

// Shared user search. Two callers:
//   - FriendSearch (no scope) — anyone, matches all users, returns is_friend.
//   - Moment composer (scope=mutual|all) — mutual restricts to the caller's
//     mutual friends; all is designer-only (403 otherwise) and searches everyone.
// The `is_mutual` flag is always returned so the composer can label results.
export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const query = req.nextUrl.searchParams.get("q");
    const scope = req.nextUrl.searchParams.get("scope"); // undefined | "mutual" | "all"
    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    if (scope === "all" && !(await isDesigner(userId))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Mutual friendship = a friendship row in both directions. Default and
    // scope=all search every user; scope=mutual restricts to mutual friends.
    const mutualOnly = scope === "mutual";
    const { rows } = await pool.query(
      `SELECT
          u.id, u.username, COALESCE(u.display_name, u.name) AS display_name, u.avatar,
          EXISTS(SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = u.id) AS is_friend,
          EXISTS(
            SELECT 1 FROM friendships f1
              JOIN friendships f2 ON f2.user_id = f1.friend_id AND f2.friend_id = f1.user_id
             WHERE f1.user_id = $1 AND f1.friend_id = u.id
          ) AS is_mutual
        FROM users u
       WHERE u.id != $1
         AND (u.username ILIKE $2 OR u.display_name ILIKE $2 OR u.name ILIKE $2)
         AND (
           NOT $3::boolean OR EXISTS(
             SELECT 1 FROM friendships f1
               JOIN friendships f2 ON f2.user_id = f1.friend_id AND f2.friend_id = f1.user_id
              WHERE f1.user_id = $1 AND f1.friend_id = u.id
           )
         )
       LIMIT 20`,
      [userId, `%${query}%`, mutualOnly]
    );

    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error("Error searching users:", err);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
