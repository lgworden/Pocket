import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { REACTION_VALUES, type FeedReactionType } from "@/lib/feed";

// Toggle one of the current user's reactions on a post. Insert if absent, remove
// if already present — so tapping 🔥 twice clears it. Returns the post's fresh
// counts and this user's remaining reactions for optimistic UI reconciliation.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  const { reaction } = await req.json();

  if (!REACTION_VALUES.includes(reaction)) {
    return NextResponse.json({ error: "invalid reaction" }, { status: 400 });
  }

  // Ensure the post exists (and is reactable) before mutating.
  const { rows: postRows } = await pool.query(
    "SELECT id FROM feed_posts WHERE id = $1",
    [params.id]
  );
  if (postRows.length === 0) {
    return NextResponse.json({ error: "post not found" }, { status: 404 });
  }

  const existing = await pool.query(
    "SELECT id FROM feed_reactions WHERE post_id = $1 AND user_id = $2 AND reaction = $3",
    [params.id, userId, reaction]
  );

  if (existing.rows.length > 0) {
    await pool.query("DELETE FROM feed_reactions WHERE id = $1", [existing.rows[0].id]);
  } else {
    await pool.query(
      `INSERT INTO feed_reactions (post_id, user_id, reaction) VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id, reaction) DO NOTHING`,
      [params.id, userId, reaction]
    );
  }

  const counts = await pool.query<{ reaction: FeedReactionType; count: string }>(
    "SELECT reaction, COUNT(*)::int AS count FROM feed_reactions WHERE post_id = $1 GROUP BY reaction",
    [params.id]
  );
  const mine = await pool.query<{ reaction: FeedReactionType }>(
    "SELECT reaction FROM feed_reactions WHERE post_id = $1 AND user_id = $2",
    [params.id, userId]
  );

  const reaction_counts: Partial<Record<FeedReactionType, number>> = {};
  for (const row of counts.rows) reaction_counts[row.reaction] = Number(row.count);

  return NextResponse.json({
    reaction_counts,
    my_reactions: mine.rows.map((r) => r.reaction),
  });
}
