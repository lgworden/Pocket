import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { markAllRead } from "@/lib/notifications";

export async function POST() {
  const userId = await getCurrentUserId();
  await markAllRead(userId);
  return NextResponse.json({ ok: true });
}
