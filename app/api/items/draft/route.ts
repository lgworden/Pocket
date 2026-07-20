import { NextRequest, NextResponse } from "next/server";
import { draftItemFromPhoto } from "@/lib/anthropic";
import { saveBase64Photo } from "@/lib/photos";

// Add Item flow, step 1: snap a photo -> Claude drafts the item fields.
// Body: { image: base64 (no data: prefix), mediaType: "image/jpeg" }
export async function POST(req: NextRequest) {
  const { image, mediaType } = await req.json();
  if (!image || !mediaType) {
    return NextResponse.json({ error: "image and mediaType are required" }, { status: 400 });
  }

  const [draft, photoUrl] = await Promise.all([
    draftItemFromPhoto(image, mediaType),
    saveBase64Photo(image, mediaType),
  ]);

  return NextResponse.json({ draft, photoUrl });
}
