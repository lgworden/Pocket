import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

// Soft-delete: sets status to 'archived' rather than dropping the row, so wear
// history / cost-per-wear / badge stats built from outfit_logs stay intact.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();

  const { rows } = await pool.query(
    `UPDATE items SET status = 'archived'
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [params.id, userId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
