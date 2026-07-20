import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { saveBase64Photo } from "@/lib/photos";
import { VISIBILITY_VALUES, type FeedVisibility } from "@/lib/feed";

// Create a feed post: upload the outfit photo, then insert with a visibility tier.
// Body: { image: base64, mediaType, caption?, visibility }
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { image, mediaType, caption, visibility } = await req.json();

  if (!image || !mediaType) {
    return NextResponse.json({ error: "image and mediaType are required" }, { status: 400 });
  }

  const tier: FeedVisibility = VISIBILITY_VALUES.includes(visibility) ? visibility : "friends";
  const photo = await saveBase64Photo(image, mediaType);

  const { rows } = await pool.query(
    `INSERT INTO feed_posts (user_id, photo, caption, visibility)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, photo, caption?.trim() || null, tier]
  );

  return NextResponse.json({ id: rows[0].id, photo });
}
