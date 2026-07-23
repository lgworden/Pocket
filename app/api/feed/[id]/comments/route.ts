import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import type { FeedComment } from "@/lib/feed";

// Add a comment to a post. Returns the post's fresh comment list + count so the
// client can reconcile its optimistic bubble with server truth (same pattern as react).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  const { body } = await req.json();
  const text = typeof body === "string" ? body.trim() : "";

  if (!text) {
    return NextResponse.json({ error: "comment body is required" }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: "comment is too long" }, { status: 400 });
  }

  const { rows: postRows } = await pool.query(
    "SELECT id FROM feed_posts WHERE id = $1",
    [params.id]
  );
  if (postRows.length === 0) {
    return NextResponse.json({ error: "post not found" }, { status: 404 });
  }

  await pool.query(
    "INSERT INTO feed_comments (post_id, user_id, body) VALUES ($1, $2, $3)",
    [params.id, userId, text]
  );

  const { rows } = await pool.query<FeedComment>(
    `SELECT c.id, c.user_id AS author_id, COALESCE(u.display_name, u.name) AS author_name,
            c.body, c.created_at
     FROM feed_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC`,
    [params.id]
  );

  return NextResponse.json({ comments: rows, comment_count: rows.length });
}
