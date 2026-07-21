import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// Delete one of the current user's own logged fits. Any feed post shared from
// it keeps its own copy of the photo and just loses the cross-link
// (feed_posts.outfit_log_id ON DELETE SET NULL) — deleting a recent fit never
// deletes a post already shared to the feed.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();

  const { rows } = await pool.query(
    "DELETE FROM outfit_logs WHERE id = $1 AND user_id = $2 RETURNING id",
    [params.id, userId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "fit not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
