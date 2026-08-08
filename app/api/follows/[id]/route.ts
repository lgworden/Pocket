import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { follow, unfollow } from "@/lib/follows";
import { track } from "@/lib/analytics";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (userId === params.id) {
    return NextResponse.json({ error: "cannot follow yourself" }, { status: 400 });
  }

  // Only designer accounts can be followed (lib/designers.ts). The follow
  // button is already hidden on every other profile, so a rejection here means
  // a hand-rolled request — answer with a flat 403 and no explanation rather
  // than confirming the status exists.
  if (!(await follow(userId, params.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  track(userId, "user_followed", { followeeId: params.id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await unfollow(userId, params.id);
  return NextResponse.json({ ok: true });
}
