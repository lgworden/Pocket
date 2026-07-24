import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { saveBase64Photo } from "@/lib/photos";
import { analyzeUserBehavior } from "@/lib/preferenceAnalyzer";
import { track } from "@/lib/analytics";

// Logs a "recent fit" pic from the Closet screen: a private photo tagged with
// the closet items worn. This writes to outfit_logs like the recommendation
// "Wore it" flow, so tagged items pick up wear count / cost-per-wear / badge
// credit and drop out of tomorrow's recommendations automatically.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { image, mediaType, itemIds, notes } = await req.json();

  if (!image || !mediaType) {
    return NextResponse.json({ error: "image and mediaType are required" }, { status: 400 });
  }

  let taggedItemIds: string[] = [];
  if (Array.isArray(itemIds) && itemIds.length > 0) {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM items WHERE user_id = $1 AND id = ANY($2)`,
      [userId, itemIds]
    );
    taggedItemIds = rows.map((r) => r.id);
  }

  const photo = await saveBase64Photo(image, mediaType);

  const { rows } = await pool.query(
    `INSERT INTO outfit_logs (user_id, item_ids, photo, source, visibility, notes)
     VALUES ($1, $2, $3, 'self_styled', 'private', $4)
     RETURNING id, photo, created_at`,
    [userId, taggedItemIds, photo, notes?.trim() || null]
  );

  track(userId, "outfit_logged", { source: "self_styled", taggedItemCount: taggedItemIds.length });

  if (taggedItemIds.length > 0) {
    analyzeUserBehavior(userId).catch((err) =>
      console.error("[API] Background preference analysis failed:", err)
    );
  }

  return NextResponse.json(rows[0], { status: 201 });
}
