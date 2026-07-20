import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { setFriendTier } from "@/lib/friends";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tier } = await req.json();
  if (tier !== "friend" && tier !== "close_friend") {
    return NextResponse.json({ error: "invalid tier" }, { status: 400 });
  }

  await setFriendTier(userId, params.id, tier);
  return NextResponse.json({ ok: true });
}
