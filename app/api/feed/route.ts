import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { saveBase64Photo } from "@/lib/photos";
import { VISIBILITY_VALUES, type FeedVisibility } from "@/lib/feed";

// Create a feed post: upload the outfit photo, then insert with a visibility tier.
// Body: { image: base64, mediaType, caption?, visibility, location?, taggedFriendIds? }
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { image, mediaType, caption, visibility, location, taggedFriendIds } = await req.json();

  if (!image || !mediaType) {
    return NextResponse.json({ error: "image and mediaType are required" }, { status: 400 });
  }

  const tier: FeedVisibility = VISIBILITY_VALUES.includes(visibility) ? visibility : "friends";

  // Only allow tagging people the author is actually friends with — filter the
  // requested ids down to confirmed friendships so a client can't tag strangers.
  let taggedIds: string[] = [];
  if (Array.isArray(taggedFriendIds) && taggedFriendIds.length > 0) {
    const { rows: friendRows } = await pool.query<{ friend_id: string }>(
      "SELECT friend_id FROM friendships WHERE user_id = $1 AND friend_id = ANY($2)",
      [userId, taggedFriendIds]
    );
    taggedIds = friendRows.map((r) => r.friend_id);
  }

  const photo = await saveBase64Photo(image, mediaType);

  const { rows } = await pool.query(
    `INSERT INTO feed_posts (user_id, photo, caption, visibility, location, tagged_user_ids)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, photo, caption?.trim() || null, tier, location?.trim() || null, taggedIds]
  );

  return NextResponse.json({ id: rows[0].id, photo });
}
