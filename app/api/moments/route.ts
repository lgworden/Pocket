import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { track } from "@/lib/analytics";
import {
  createMoment,
  getCreatedMoments,
  getInvitedMoments,
  MomentError,
  type CreateMomentInput,
} from "@/lib/moments";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tab = req.nextUrl.searchParams.get("tab");
  if (tab === "created") {
    return NextResponse.json({ created: await getCreatedMoments(userId) });
  }
  if (tab === "invited") {
    return NextResponse.json({ invited: await getInvitedMoments(userId) });
  }
  const [created, invited] = await Promise.all([
    getCreatedMoments(userId),
    getInvitedMoments(userId),
  ]);
  return NextResponse.json({ created, invited });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as CreateMomentInput;
    const moment = await createMoment(userId, body);
    track(userId, "moment_created", {
      momentId: moment.id,
      inviteeCount: moment.members.length - 1,
    });
    return NextResponse.json(moment, { status: 201 });
  } catch (err) {
    if (err instanceof MomentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Failed to create moment:", err);
    return NextResponse.json({ error: "Failed to create moment" }, { status: 500 });
  }
}
