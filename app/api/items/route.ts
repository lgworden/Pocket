import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { nextDisplayId } from "@/lib/displayId";
import { saveBase64Photo } from "@/lib/photos";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  const params = req.nextUrl.searchParams;

  const conditions: string[] = ["user_id = $1"];
  const values: unknown[] = [userId];

  const status = params.get("status");
  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  } else {
    conditions.push(`status != 'archived'`);
  }

  const category = params.get("category");
  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }

  const occasion = params.get("occasion");
  if (occasion) {
    values.push(occasion);
    conditions.push(`$${values.length} = ANY(occasions)`);
  }

  const color = params.get("color");
  if (color) {
    values.push(color);
    conditions.push(`$${values.length} = ANY(colors)`);
  }

  const provenance = params.get("provenance");
  if (provenance) {
    values.push(provenance);
    conditions.push(`provenance = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT * FROM items WHERE ${conditions.join(" AND ")} ORDER BY date_added DESC`,
    values
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json();

  const {
    name,
    category,
    subcategory,
    occasions,
    tags,
    colors,
    warmth,
    formality,
    seasons,
    provenance,
    cost,
    photos,
    photoBase64,
    photoMediaType,
  } = body;

  if (!name || !category) {
    return NextResponse.json({ error: "name and category are required" }, { status: 400 });
  }

  // Some flows (e.g. "log my items" from a decomposed outfit photo) hand over
  // a not-yet-uploaded crop instead of an already-saved photo URL.
  const inlinePhotoUrl =
    photoBase64 && photoMediaType ? await saveBase64Photo(photoBase64, photoMediaType) : null;
  const finalPhotos = inlinePhotoUrl ? [inlinePhotoUrl, ...(photos ?? [])] : photos ?? [];

  const displayId = await nextDisplayId(category);

  const { rows } = await pool.query(
    `INSERT INTO items
      (display_id, user_id, name, category, subcategory, occasions, tags, colors,
       warmth, formality, seasons, provenance, cost, photos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      displayId,
      userId,
      name,
      category,
      subcategory ?? null,
      occasions ?? [],
      tags ?? [],
      colors ?? [],
      warmth ?? null,
      formality ?? null,
      seasons ?? [],
      provenance ?? null,
      cost ?? null,
      finalPhotos,
    ]
  );

  return NextResponse.json(rows[0], { status: 201 });
}
