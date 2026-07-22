import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const query = req.nextUrl.searchParams.get("q");
    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const { rows } = await pool.query(
      `SELECT
        u.id, u.username, u.display_name, u.avatar_url,
        EXISTS(SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = u.id) as is_friend
      FROM users u
      WHERE u.id != $1 AND (u.username ILIKE $2 OR u.display_name ILIKE $2)
      LIMIT 20`,
      [userId, `%${query}%`]
    );

    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error("Error searching users:", err);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
