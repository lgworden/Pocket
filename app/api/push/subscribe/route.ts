import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { saveSubscription } from "@/lib/push";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json();

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await saveSubscription(userId, body);
  return NextResponse.json({ ok: true });
}
