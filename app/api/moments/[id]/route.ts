import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { track } from "@/lib/analytics";
import {
  updateMoment,
  deleteMoment,
  MomentError,
  type UpdateMomentInput,
} from "@/lib/moments";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as UpdateMomentInput;
    const moment = await updateMoment(userId, params.id, body);
    track(userId, "moment_updated", { momentId: params.id });
    return NextResponse.json(moment);
  } catch (err) {
    if (err instanceof MomentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Failed to update moment:", err);
    return NextResponse.json({ error: "Failed to update moment" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await deleteMoment(userId, params.id);
    track(userId, "moment_deleted", { momentId: params.id });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof MomentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Failed to delete moment:", err);
    return NextResponse.json({ error: "Failed to delete moment" }, { status: 500 });
  }
}
