import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { saveBase64Photo } from "@/lib/photos";
import { track } from "@/lib/analytics";
import { addFit, getMomentForViewer, MomentError } from "@/lib/moments";

// Add the caller's own outfit candidate to a moment. Body: { image: base64,
// mediaType, caption? }. Stored as a moment-linked feed post (out of the feed).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { image, mediaType, caption } = await req.json();
    if (!image || !mediaType) {
      return NextResponse.json({ error: "image and mediaType are required" }, { status: 400 });
    }
    const photo = await saveBase64Photo(image, mediaType);
    await addFit(userId, params.id, photo, caption);
    track(userId, "feed_post_created", { momentId: params.id, kind: "moment_fit" });
    return NextResponse.json(await getMomentForViewer(params.id, userId));
  } catch (err) {
    if (err instanceof MomentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Failed to add fit:", err);
    return NextResponse.json({ error: "Failed to add fit" }, { status: 500 });
  }
}
