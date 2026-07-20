import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { saveBase64Photo } from "@/lib/photos";

// Lets a user add a photo to an item after the fact (e.g. from the closet list,
// where items without a photo show an inline "add photo" affordance instead of
// a blank image block).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  const { image, mediaType } = await req.json();
  if (!image || !mediaType) {
    return NextResponse.json({ error: "image and mediaType are required" }, { status: 400 });
  }

  const photoUrl = await saveBase64Photo(image, mediaType);
  const { rows } = await pool.query(
    `UPDATE items SET photos = array_append(photos, $1)
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [photoUrl, params.id, userId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
