import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { deleteFitInspo, getMomentForViewer, MomentError } from "@/lib/moments";

// Remove a reference image (uploader or the moment's creator only).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; inspoId: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await deleteFitInspo(userId, params.inspoId);
    return NextResponse.json(await getMomentForViewer(params.id, userId));
  } catch (err) {
    if (err instanceof MomentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Failed to delete fit inspo:", err);
    return NextResponse.json({ error: "Failed to delete inspo" }, { status: 500 });
  }
}
