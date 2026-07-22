import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { addFriend } from "@/lib/friends";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { friendId } = await req.json();
    if (!friendId) {
      return NextResponse.json({ error: "Friend ID required" }, { status: 400 });
    }

    if (userId === friendId) {
      return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });
    }

    await addFriend(userId, friendId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error adding friend:", err);
    return NextResponse.json({ error: "Failed to add friend" }, { status: 500 });
  }
}
