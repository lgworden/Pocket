import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { addMembers, getMomentForViewer, MomentError } from "@/lib/moments";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      invitee_user_ids?: string[];
      collaborator_user_ids?: string[];
    };
    await addMembers(userId, params.id, body);
    track(userId, "moment_member_added", {
      momentId: params.id,
      invitees: (body.invitee_user_ids ?? []).length,
      collaborators: (body.collaborator_user_ids ?? []).length,
    });
    const moment = await getMomentForViewer(params.id, userId);
    return NextResponse.json(moment);
  } catch (err) {
    if (err instanceof MomentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Failed to add members:", err);
    return NextResponse.json({ error: "Failed to add members" }, { status: 500 });
  }
}
