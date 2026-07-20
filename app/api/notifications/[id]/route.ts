import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { markRead } from "@/lib/notifications";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  await markRead(userId, params.id);
  return NextResponse.json({ ok: true });
}
