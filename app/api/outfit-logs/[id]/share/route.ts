import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { VISIBILITY_VALUES, type FeedVisibility } from "@/lib/feed";
import { track } from "@/lib/analytics";

// Promotes a private "recent fit" log to the public Feed, reusing the same
// photo (already on disk) rather than re-uploading. Links back via
// outfit_log_id so the feed post and the closet log stay associated.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  const { caption, visibility } = await req.json();

  const tier: FeedVisibility =
    VISIBILITY_VALUES.includes(visibility) && visibility !== "private" ? visibility : "friends";

  const { rows: logRows } = await pool.query<{ photo: string | null }>(
    `SELECT photo FROM outfit_logs WHERE id = $1 AND user_id = $2`,
    [params.id, userId]
  );
  const photo = logRows[0]?.photo;
  if (!photo) {
    return NextResponse.json({ error: "outfit log not found" }, { status: 404 });
  }

  const { rows } = await pool.query(
    `INSERT INTO feed_posts (user_id, photo, caption, visibility, outfit_log_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, photo, caption?.trim() || null, tier, params.id]
  );

  track(userId, "feed_post_created", { postId: rows[0].id, visibility: tier, fromOutfitLog: true });

  return NextResponse.json({ id: rows[0].id }, { status: 201 });
}
