import { getCurrentUserId } from "@/lib/auth";
import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const photoUrl = searchParams.get("photo");

  if (!photoUrl) {
    return NextResponse.json(
      { error: "Photo URL required" },
      { status: 400 }
    );
  }

  try {
    // Verify ownership
    const { rows: itemRows } = await pool.query(
      "SELECT photos FROM items WHERE id = $1 AND user_id = $2",
      [params.id, userId]
    );

    if (itemRows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const currentPhotos = itemRows[0].photos || [];

    // Remove the photo from the array
    const updatedPhotos = currentPhotos.filter(
      (p: string) => p !== photoUrl
    );

    // Update the database
    await pool.query(
      "UPDATE items SET photos = $1 WHERE id = $2 AND user_id = $3",
      [updatedPhotos, params.id, userId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error removing photo:", err);
    return NextResponse.json(
      { error: "Failed to remove photo" },
      { status: 500 }
    );
  }
}
