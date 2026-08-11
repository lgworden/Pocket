import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { syncMomentToGcal, MomentError } from "@/lib/moments";

// Write a moment to Google Calendar (or unlink it). Body: { write: boolean }.
// Only the creator or a collaborator may sync. One-directional (Pocket → GCal).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { write } = (await req.json()) as { write?: boolean };
    const moment = await syncMomentToGcal(userId, params.id, write !== false);
    track(userId, "moment_updated", { momentId: params.id, gcalSync: write !== false });
    return NextResponse.json(moment);
  } catch (err) {
    if (err instanceof MomentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Failed to sync moment to Google Calendar:", err);
    return NextResponse.json({ error: "Failed to sync to Google Calendar" }, { status: 500 });
  }
}
