import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { respondToInvite, MomentError } from "@/lib/moments";

// Accept or decline your own invite. Only the invited user may change their own
// row — enforced by keying the update on the caller's id, so params.userId must
// match the session.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (userId !== params.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { status?: string };
    if (body.status !== "accepted" && body.status !== "declined") {
      return NextResponse.json({ error: "status must be accepted or declined" }, { status: 400 });
    }
    const moment = await respondToInvite(userId, params.id, body.status);
    track(userId, "moment_invite_responded", { momentId: params.id, status: body.status });
    return NextResponse.json(moment);
  } catch (err) {
    if (err instanceof MomentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Failed to respond to invite:", err);
    return NextResponse.json({ error: "Failed to respond to invite" }, { status: 500 });
  }
}
