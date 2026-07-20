import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { generateSketchForPhoto } from "@/lib/sketch";

// On-demand: turns an item's photo into a fashion-sketchbook croquis and stores
// it on the item. User-initiated (a button on the item detail screen), never
// part of the add-item flow — so nobody waits on it and we don't spend on items
// the user never opens.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();

  const { rows } = await pool.query<{
    photos: string[];
    name: string;
    category: string;
    colors: string[];
  }>(
    `SELECT photos, name, category, colors FROM items WHERE id = $1 AND user_id = $2`,
    [params.id, userId]
  );
  const item = rows[0];
  if (!item) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }
  const photoUrl = item.photos?.[0];
  if (!photoUrl) {
    return NextResponse.json(
      { error: "Add a photo first — the sketch is drawn from it." },
      { status: 400 }
    );
  }

  try {
    const sketchUrl = await generateSketchForPhoto(photoUrl, {
      name: item.name,
      category: item.category,
      colors: item.colors ?? [],
    });
    await pool.query(
      `UPDATE items SET sketch = $1 WHERE id = $2 AND user_id = $3`,
      [sketchUrl, params.id, userId]
    );
    return NextResponse.json({ sketch: sketchUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't generate a sketch — try again?";
    // 502 for provider/config failures so the client can show the real reason.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
