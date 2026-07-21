import { NextRequest, NextResponse } from "next/server";
import { draftItemsFromOutfitPhoto } from "@/lib/anthropic";
import { saveBase64Photo } from "@/lib/photos";

// "Log my items" flow, step 1: one full outfit photo -> Claude identifies each
// piece worn. The full photo is saved once and returned as a fallback; the
// client crops a per-item thumbnail out of the same photo itself.
export async function POST(req: NextRequest) {
  const { image, mediaType } = await req.json();
  if (!image || !mediaType) {
    return NextResponse.json({ error: "image and mediaType are required" }, { status: 400 });
  }

  try {
    const [result, photoUrl] = await Promise.all([
      draftItemsFromOutfitPhoto(image, mediaType),
      saveBase64Photo(image, mediaType),
    ]);
    return NextResponse.json({ items: result.items ?? [], photoUrl });
  } catch (err) {
    console.error("POST /api/items/draft-outfit failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
