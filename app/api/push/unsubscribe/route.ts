import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { removeSubscription } from "@/lib/push";

export async function POST(req: NextRequest) {
  await getCurrentUserId(); // require a session, but any subscriber can drop their own endpoint
  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  await removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
