import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { saveBase64Photo } from "@/lib/photos";
import { addFitInspo, getMomentForViewer, MomentError } from "@/lib/moments";

// Pin a reference image to a moment's moodboard. Body: { image: base64, mediaType }.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { image, mediaType } = await req.json();
    if (!image || !mediaType) {
      return NextResponse.json({ error: "image and mediaType are required" }, { status: 400 });
    }
    const url = await saveBase64Photo(image, mediaType);
    await addFitInspo(userId, params.id, url);
    return NextResponse.json(await getMomentForViewer(params.id, userId));
  } catch (err) {
    if (err instanceof MomentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Failed to add fit inspo:", err);
    return NextResponse.json({ error: "Failed to add inspo" }, { status: 500 });
  }
}
