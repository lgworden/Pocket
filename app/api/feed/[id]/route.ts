import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// Delete one of the current user's own feed posts. feed_reactions cascades.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();

  const { rows } = await pool.query(
    "DELETE FROM feed_posts WHERE id = $1 AND user_id = $2 RETURNING id",
    [params.id, userId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "post not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
