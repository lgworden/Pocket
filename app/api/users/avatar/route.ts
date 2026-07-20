import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { saveBase64Photo } from "@/lib/photos";

// Sets the signed-in user's profile photo, shown on /profile/[id]. Always the
// caller's own row — there's no id param, avatars can't be set for anyone else.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const { image, mediaType } = await req.json();
  if (!image || !mediaType) {
    return NextResponse.json({ error: "image and mediaType are required" }, { status: 400 });
  }

  const avatarUrl = await saveBase64Photo(image, mediaType);
  await pool.query("UPDATE users SET avatar = $1 WHERE id = $2", [avatarUrl, userId]);

  return NextResponse.json({ avatar: avatarUrl });
}
